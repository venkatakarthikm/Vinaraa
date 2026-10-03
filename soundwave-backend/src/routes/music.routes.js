'use strict';

const express = require('express');
const { Readable } = require('stream');
const { asyncHandler } = require('../utils/async');
const { ok, paginated } = require('../utils/apiResponse');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const { upstreamLimiter } = require('../middleware/rateLimit');
const catalog = require('../services/catalog');
const Song = require('../models/Song');
const recommendationService = require('../services/recommendationService');
const SearchHistory = require('../models/SearchHistory');
const s = require('../validators/schemas');

const router = express.Router();

router.get(
  '/home/popup',
  asyncHandler(async (req, res) => {
    const Popup = require('../models/Popup');
    const { sanitizeHtml, renderPlaceholders } = require('../services/sanitizer');

    const filter = { enabled: true };
    if (req.user) {
      filter.$or = [
        { 'audience.mode': 'all' },
        { 'audience.mode': 'selected', 'audience.userIds': req.user._id },
      ];
    } else {
      filter['audience.mode'] = 'all';
    }

    const popup = await Popup.findOne(filter).sort({ updatedAt: -1 }).lean();
    if (!popup) return ok(res, { popup: null });

    const renderedHtml = renderPlaceholders(sanitizeHtml(popup.html), req.user || {});
    return ok(res, {
      popup: {
        id: String(popup._id),
        name: popup.name,
        html: renderedHtml,
      },
    });
  })
);

/** Public browse endpoints work anonymously; personalised ones use optionalAuth. */
router.use(optionalAuth);

function mergeByStableId(primaryList = [], secondaryList = []) {
  const map = new Map();

  for (const item of primaryList) {
    if (!item) continue;
    const id = String(item.id || item.saavnId || '');
    if (id) map.set(id, item);
  }

  for (const item of secondaryList) {
    if (!item) continue;
    const id = String(item.id || item.saavnId || '');
    if (id) {
      const existing = map.get(id);
      map.set(id, existing ? { ...existing, ...item } : item);
    }
  }

  return [...map.values()];
}

/**
 * Unified search. type=all fans out to the four upstream scopes in parallel and
 * returns one payload — the app renders four sections from a single request.
 */
router.get(
  '/search',
  upstreamLimiter,
  validate(s.searchSchema),
  asyncHandler(async (req, res) => {
    const { q, type, page, limit, language } = req.query;

    const record = async () => {
      if (!req.user) return;
      await SearchHistory.findOneAndUpdate(
        { user: req.user._id, normalizedQuery: q.trim().toLowerCase() },
        { $set: { query: q, scope: type, createdAt: new Date() }, $inc: { resultCount: 1 }, $setOnInsert: { user: req.user._id } },
        { upsert: true }
      ).catch(() => {});
    };

    if (type !== 'all') {
      if (type === 'songs') {
        const [workerResult, autoRes] = await Promise.allSettled([
          catalog.searchSongs(q, { page, limit, language }),
          page === 0 ? catalog.autocomplete(q) : Promise.resolve(null),
        ]);

        const result = workerResult.status === 'fulfilled' ? workerResult.value : { results: [], total: 0 };
        await record();

        const workerRawSongs = result.results || [];
        const songs = await Song.find({ saavnId: { $in: workerRawSongs.map((r) => String(r.id)).filter(Boolean) } }).lean();
        const map = new Map(songs.map((x) => [x.saavnId, x]));
        const workerItems = workerRawSongs.map((r) => {
          const local = map.get(String(r.id));
          return local ? catalog.toClientSong(local) : catalog.toClientSong(catalog.normalizeSong(r));
        });

        // Persist the upstream ones
        const upstreamRaw = workerRawSongs.filter(r => !map.has(String(r.id)));
        if (upstreamRaw.length) {
          catalog.persistSongs(upstreamRaw).catch(() => {});
        }

        const autoSongs = (autoRes.status === 'fulfilled' && autoRes.value) ? autoRes.value.songs : [];
        const mergedItems = page === 0 ? mergeByStableId(autoSongs, workerItems) : workerItems;

        return paginated(res, mergedItems, { page, limit, total: result.total || mergedItems.length, extra: { scope: 'songs', stale: result.stale, upstream: result.upstream } });
      }

      const [workerResult, autoRes] = await Promise.allSettled([
        catalog.searchGeneric(type, q, { page, limit }),
        page === 0 ? catalog.autocomplete(q) : Promise.resolve(null),
      ]);

      const result = workerResult.status === 'fulfilled' ? workerResult.value : { results: [], total: 0 };
      await record();

      const workerRaw = result.results || [];
      const workerItems = workerRaw.map((r) => {
        if (!r) return null;
        if (type === 'albums') {
          return {
            id: String(r.id),
            name: catalog.decode(r.name || r.title) || 'Unknown Album',
            title: catalog.decode(r.name || r.title) || 'Unknown Album',
            year: r.year ? String(r.year) : undefined,
            language: r.language || undefined,
            songCount: r.songCount || (r.songs ? r.songs.length : undefined),
            image: catalog.maxQualityImage(r.image || []),
            artwork: {
              small: catalog.imageByQuality(r.image || [], '50x50'),
              medium: catalog.imageByQuality(r.image || [], '150x150'),
              large: catalog.imageByQuality(r.image || [], '500x500'),
            },
            url: r.url || undefined,
          };
        }
        if (type === 'artists') {
          return {
            id: String(r.id),
            name: catalog.decode(r.name || r.title) || 'Unknown Artist',
            title: catalog.decode(r.name || r.title) || 'Unknown Artist',
            type: 'artist',
            role: r.role || r.description || 'Artist',
            image: catalog.maxQualityImage(r.image || []),
          };
        }
        if (type === 'playlists') {
          return {
            id: String(r.id),
            name: catalog.decode(r.name || r.title) || 'Unknown Playlist',
            title: catalog.decode(r.name || r.title) || 'Unknown Playlist',
            type: 'playlist',
            image: catalog.maxQualityImage(r.image || []),
          };
        }
        return r;
      }).filter(Boolean);

      const autoData = (autoRes.status === 'fulfilled' && autoRes.value) ? autoRes.value : {};
      const autoItems = autoData[type] || [];
      const mergedItems = page === 0 ? mergeByStableId(autoItems, workerItems) : workerItems;

      return paginated(res, mergedItems, { page, limit, total: Math.max(result.total || 0, mergedItems.length), extra: { scope: type, stale: result.stale } });
    }

    const [songs, albums, artists, playlists, autoRes] = await Promise.allSettled([
      catalog.searchSongs(q, { page, limit, language }),
      catalog.searchGeneric('albums', q, { page, limit: Math.min(limit, 10) }),
      catalog.searchGeneric('artists', q, { page, limit: Math.min(limit, 10) }),
      catalog.searchGeneric('playlists', q, { page, limit: Math.min(limit, 10) }),
      catalog.autocomplete(q),
    ]);
    await record();

    if (songs.status === 'fulfilled' && songs.value.results?.length) {
      catalog.persistSongs(songs.value.results).catch(() => {});
    }

    const unwrap = (r, key) => (r.status === 'fulfilled' ? r.value[key] : []);
    const failures = [songs, albums, artists, playlists].filter((r) => r.status === 'rejected').length;
    if (failures === 4 && autoRes.status !== 'fulfilled') throw AppError.upstream('Search is temporarily unavailable — all upstream hosts failed', { query: q });

    const autoData = autoRes.status === 'fulfilled' ? autoRes.value : { songs: [], albums: [], artists: [], playlists: [] };
    const workerSongs = unwrap(songs, 'results').map((r) => catalog.toClientSong(catalog.normalizeSong(r)));
    const workerAlbums = unwrap(albums, 'results');
    const workerArtists = unwrap(artists, 'results');
    const workerPlaylists = unwrap(playlists, 'results');

    return ok(res, {
      query: q,
      songs: mergeByStableId(autoData.songs || [], workerSongs),
      albums: mergeByStableId(autoData.albums || [], workerAlbums),
      artists: mergeByStableId(autoData.artists || [], workerArtists),
      playlists: mergeByStableId(autoData.playlists || [], workerPlaylists),
      partial: failures > 0,
    });
  })
);

/** Type-ahead suggestions: local catalogue + JioSaavn autocomplete. */
router.get(
  '/search/suggestions',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return ok(res, { query: q, suggestions: [] });

    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [historyRes, localSongsRes, localEntitiesRes, autoRes] = await Promise.allSettled([
      req.user ? SearchHistory.find({ user: req.user._id, query: rx }).sort({ createdAt: -1 }).limit(5).lean() : Promise.resolve([]),
      Song.find({ name: rx }).sort({ 'metrics.trendingScore': -1, playCount: -1 }).limit(5).select('saavnId name images singers album').lean(),
      require('../models/Entity').find({ name: rx }).sort({ 'metrics.popularity': -1 }).limit(5).select('entityId name type image').lean(),
      catalog.autocomplete(q),
    ]);

    const suggestions = [];
    const seen = new Set();

    const add = (item) => {
      const key = `${item.type}-${item.id || item.text}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push(item);
      }
    };

    if (historyRes.status === 'fulfilled' && historyRes.value) {
      for (const h of historyRes.value) {
        add({ type: 'history', text: h.query });
      }
    }

    if (autoRes.status === 'fulfilled' && autoRes.value) {
      const ac = autoRes.value;
      for (const a of (ac.albums || [])) add({ type: 'album', id: a.id, text: a.name, subtitle: `Album ${a.year ? `· ${a.year}` : ''}`, image: a.image });
      for (const s of (ac.songs || [])) add({ type: 'song', id: s.id, text: s.name, subtitle: s.artistsText, image: s.image });
      for (const a of (ac.artists || [])) add({ type: 'artist', id: a.id, text: a.name, subtitle: a.role, image: a.image });
      for (const p of (ac.playlists || [])) add({ type: 'playlist', id: p.id, text: p.name, subtitle: 'Playlist', image: p.image });
    }

    if (localSongsRes.status === 'fulfilled' && localSongsRes.value) {
      for (const x of localSongsRes.value) {
        add({
          type: 'song',
          id: x.saavnId,
          text: x.name,
          subtitle: (x.singers || []).map((s) => s.name).join(', '),
          image: catalog.maxQualityImage(x.images || []),
        });
      }
    }

    if (localEntitiesRes.status === 'fulfilled' && localEntitiesRes.value) {
      for (const e of localEntitiesRes.value) {
        add({ type: e.type, id: e.entityId, text: e.name, image: e.image });
      }
    }

    return ok(res, {
      query: q,
      suggestions,
    });
  })
);

/* ── songs ───────────────────────────────────────────────────── */
router.get(
  '/songs/:id',
  asyncHandler(async (req, res) => {
    const { song, upstream } = await catalog.getSong(req.params.id, { refresh: req.query.refresh === 'true' });
    const quality = req.user?.preferences?.audioQuality;
    const qualityMap = { low: '96kbps', medium: '160kbps', high: '320kbps', veryhigh: '320kbps' };
    return ok(res, { ...catalog.toClientSong(song, { quality: qualityMap[quality] }), upstream });
  })
);

router.get(
  '/songs',
  validate(s.idsSchema),
  asyncHandler(async (req, res) => {
    const ids = String(req.query.ids).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 50);
    const { songs, upstream } = await catalog.getSongs(ids);
    return ok(res, { songs: songs.map((x) => catalog.toClientSong(x)), missing: ids.filter((id) => !songs.some((x) => x.saavnId === id)), upstream });
  })
);

router.get(
  '/songs/:id/lyrics',
  asyncHandler(async (req, res) => {
    const local = await Song.findOne({ saavnId: req.params.id }).select('lyrics hasLyrics name').lean();
    if (local?.lyrics) return ok(res, { songId: req.params.id, name: local.name, lyrics: local.lyrics, source: 'catalogue' });
    const { lyrics, stale } = await catalog.getLyrics(req.params.id).catch(() => ({ lyrics: null }));
    if (lyrics) await Song.updateOne({ saavnId: req.params.id }, { $set: { lyrics, hasLyrics: true } }).catch(() => {});
    return ok(res, { songId: req.params.id, name: local?.name, lyrics: lyrics || null, available: Boolean(lyrics), stale });
  })
);

/** "Similar songs" for the track screen — entity-first, explained. */
router.get(
  '/songs/:id/similar',
  asyncHandler(async (req, res) => {
    const song = await Song.findOne({ saavnId: req.params.id }).lean();
    if (!song) {
      const { song: fetched } = await catalog.getSong(req.params.id).catch(() => ({ song: null }));
      if (!fetched) throw AppError.notFound('Song not found', 'SONG_NOT_FOUND');
      const recos = req.user ? await recommendationService.nextSong(req.user, { currentSongId: req.params.id, limit: 20 }) : { items: [] };
      return ok(res, { songId: req.params.id, items: recos.items, source: recos.source });
    }
    const or = [];
    if (song.album?.id) or.push({ 'album.id': song.album.id });
    if (song.singers?.length) or.push({ 'singers.id': { $in: song.singers.map((x) => x.id) } });
    if (song.musicDirectors?.length) or.push({ 'musicDirectors.id': { $in: song.musicDirectors.map((x) => x.id) } });
    if (song.actors?.length) or.push({ 'actors.id': { $in: song.actors.map((x) => x.id) } });
    if (song.language) or.push({ language: song.language });
    const similar = await Song.find({ $or: or, saavnId: { $ne: song.saavnId } })
      .sort({ 'metrics.trendingScore': -1, playCount: -1 })
      .limit(20)
      .lean();
    return ok(res, { songId: song.saavnId, items: similar.map((x) => catalog.toClientSong(x)), source: 'same_movie_cluster_language' });
  })
);

/* ── albums / artists / editorial playlists / modules ────────── */
router.get(
  '/albums/resolve',
  asyncHandler(async (req, res) => {
    const link = req.query.link;
    if (!link) throw AppError.badRequest('Missing link parameter');
    
    try {
      const u = new URL(link);
      if (!u.hostname.includes('jiosaavn.com') && !u.hostname.includes('saavn.com')) {
         throw new Error('Invalid host');
      }
    } catch {
      throw AppError.badRequest('Invalid JioSaavn link');
    }

    const { id } = await catalog.resolveAlbumLink(link);
    
    const { album, stale } = await catalog.getAlbum(id);
    if (!album) throw AppError.notFound('Album not found', 'ALBUM_NOT_FOUND');
    const local = await Song.find({ 'album.id': String(album.id || id) }).lean();
    const songs = (album.songs || album.list || []).map((raw) => {
      const normalized = catalog.normalizeSong(raw);
      const hit = local.find((l) => l.saavnId === normalized.saavnId);
      return catalog.toClientSong(hit || normalized);
    });
    return ok(res, {
      id: String(album.id || id),
      name: catalog.decode(album.name),
      year: album.year,
      language: album.language,
      songCount: album.songCount || songs.length,
      image: catalog.maxQualityImage(album.image || []),
      artists: (Array.isArray(album.artists) ? album.artists : (album.artists?.all || [])).map((a) => ({ id: a.id, name: catalog.decode(a.name), role: a.role, image: catalog.maxQualityImage(a.image || []) })),
      songs,
      stale,
    });
  })
);

router.get(
  '/albums/:id',
  asyncHandler(async (req, res) => {
    const { album, stale } = await catalog.getAlbum(req.params.id);
    if (!album) throw AppError.notFound('Album not found', 'ALBUM_NOT_FOUND');
    const local = await Song.find({ 'album.id': String(album.id || req.params.id) }).lean();
    const songs = (album.songs || album.list || []).map((raw) => {
      const normalized = catalog.normalizeSong(raw);
      const hit = local.find((l) => l.saavnId === normalized.saavnId);
      return catalog.toClientSong(hit || normalized);
    });
    return ok(res, {
      id: String(album.id || req.params.id),
      name: catalog.decode(album.name),
      year: album.year,
      language: album.language,
      songCount: album.songCount || songs.length,
      image: catalog.maxQualityImage(album.image || []),
      artists: (Array.isArray(album.artists) ? album.artists : (album.artists?.all || [])).map((a) => ({ id: a.id, name: catalog.decode(a.name), role: a.role, image: catalog.maxQualityImage(a.image || []) })),
      songs,
      stale,
    });
  })
);

router.get(
  '/artists/:id',
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 0;
    const songCount = Number(req.query.songCount) || 50;
    const albumCount = Number(req.query.albumCount) || 50;
    const artistId = String(req.params.id);

    // The upstream has a known bug returning plain text for some artist ids —
    // fall back to our own catalogue so this endpoint never 500s.
    const localEntity = await require('../models/Entity').findOne({ entityId: artistId }).lean();
    const localSongs = await Song.find({
      $or: [
        { 'singers.id': artistId },
        { 'musicDirectors.id': artistId },
        { 'actors.id': artistId },
        { 'artists.id': artistId },
      ],
    })
      .sort({ 'metrics.trendingScore': -1, playCount: -1 })
      .limit(songCount)
      .lean();

    const localAlbums = await require('../models/Entity').find({
      type: 'album',
      $or: [
        { entityId: { $in: localSongs.map(s => s.album?.id).filter(Boolean) } },
        { 'artists.id': artistId }
      ]
    }).limit(albumCount).lean();

    let upstreamArtist = null;
    let stale = false;
    try {
      const result = await catalog.getArtist(artistId, { page, songCount, albumCount });
      upstreamArtist = result.artist;
      stale = result.stale;
    } catch (err) {
      if (!localEntity && !localSongs.length) throw AppError.upstream('Artist unavailable and not in catalogue', { err: err.message });
    }

    const merged = new Map(localSongs.map((x) => [x.saavnId, x]));
    const upstreamPool = [...(upstreamArtist?.topSongs || []), ...(upstreamArtist?.singles || [])];
    const normalizedPool = upstreamPool.map((r) => catalog.normalizeSong(r)).filter(Boolean);

    const albumMap = new Map();
    for (const a of (upstreamArtist?.topAlbums || [])) {
      if (a?.id) {
        albumMap.set(String(a.id), {
          id: String(a.id),
          name: catalog.decode(a.name),
          year: a.year ? String(a.year) : undefined,
          image: catalog.maxQualityImage(a.image || []),
          songCount: a.songCount || a.songs?.length || 0,
        });
      }
    }
    for (const la of localAlbums) {
      const aid = String(la.entityId);
      if (aid && !albumMap.has(aid)) {
        albumMap.set(aid, {
          id: aid,
          name: catalog.decode(la.name),
          year: la.subtitle ? String(la.subtitle) : undefined,
          image: la.image || '',
          songCount: la.songCount || 0,
        });
      }
    }
    for (const ls of localSongs) {
      if (ls.album?.id && !albumMap.has(String(ls.album.id))) {
        albumMap.set(String(ls.album.id), {
          id: String(ls.album.id),
          name: catalog.decode(ls.album.name),
          year: ls.album.year ? String(ls.album.year) : undefined,
          image: catalog.maxQualityImage(ls.images || []),
          songCount: ls.album.songCount || 0,
        });
      }
    }

    return ok(res, {
      id: artistId,
      name: catalog.decode(upstreamArtist?.name || localEntity?.name || ''),
      role: upstreamArtist?.role || localEntity?.role,
      image: catalog.maxQualityImage(upstreamArtist?.image || []) || localEntity?.image,
      followerCount: upstreamArtist?.followerCount || localEntity?.followerCount || 0,
      bio: upstreamArtist?.bio || localEntity?.description,
      topSongs: [...merged.values()].map((x) => catalog.toClientSong(x)),
      upstreamTopSongs: normalizedPool.map((x) => catalog.toClientSong(x)),
      albums: [...albumMap.values()],
      source: upstreamArtist ? 'upstream+catalogue' : 'catalogue',
      stale,
    });
  })
);

router.get(
  '/editorial/playlists/:id',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const { playlist, stale } = await catalog.getPlaylist(req.params.id, { limit });
    if (!playlist) throw AppError.notFound('Playlist not found', 'PLAYLIST_NOT_FOUND');
    const songs = await Song.find({ saavnId: { $in: (playlist.songs || []).map((x) => String(x.id)) } }).lean();
    const map = new Map(songs.map((x) => [x.saavnId, x]));
    return ok(res, {
      ...playlist,
      name: catalog.decode(playlist.name),
      image: catalog.maxQualityImage(playlist.image || []),
      songs: (playlist.songs || []).map((r) => (map.get(String(r.id)) ? catalog.toClientSong(map.get(String(r.id))) : r)),
      stale,
    });
  })
);

/** Editorial rails for the home screen. */
router.get(
  '/modules',
  asyncHandler(async (req, res) => {
    const languages = String(req.query.languages || (req.user?.preferences?.languages?.[0] ?? 'hindi'))
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 5);
    const { rails, stale } = await catalog.getModules(languages, { limit: Number(req.query.limit) || 10 }).catch(() => ({ rails: [], stale: true }));
    res.setHeader('Cache-Control', 'public, max-age=60'); // A15-7
    return ok(res, { languages, rails, stale });
  })
);

/** Trending: our own counters first, upstream when we have no signal yet. */
router.get(
  '/trending',
  asyncHandler(async (req, res) => {
    const language = req.query.language || req.user?.preferences?.languages?.[0];
    const limit = Math.min(Number(req.query.limit) || 30, 50);
    const local = await catalog.trendingFromCatalogue({ language, limit });
    res.setHeader('Cache-Control', 'public, max-age=60'); // A15-7
    return ok(res, { language, items: local.map((x) => catalog.toClientSong(x)), source: local.length ? 'catalogue' : 'empty' });
  })
);

/** Language list for filters. */
router.get(
  '/languages',
  asyncHandler(async (_req, res) => {
    const rows = await Song.aggregate([{ $match: { language: { $ne: null } } }, { $group: { _id: '$language', songs: { $sum: 1 } } }, { $sort: { songs: -1 } }, { $limit: 40 }]);
    return ok(res, { languages: rows.map((r) => ({ code: r._id, songCount: r.songs })) });
  })
);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STREAMING
 * ─────────────────────────────────────────────────────────────────────────────
 * mode=redirect → 302 to the CDN URL (fastest, least bandwidth on our server)
 * mode=proxy    → we stream the bytes, forwarding Range requests so ExoPlayer
 *                 can seek. Use this when the CDN blocks direct hot-linking or
 *                 when you want the real CDN URL hidden from the client.
 * Auth is required either way, so the endpoint cannot be used as an open proxy.
 */
router.get(
  '/stream/:id',
  authenticate,
  validate(s.streamSchema),
  asyncHandler(async (req, res) => {
    const { quality } = req.query;
    // Default to redirect to save Render bandwidth. Proxy costs bandwidth.
    const mode = req.query.mode === 'proxy' ? 'proxy' : 'redirect';
    const { song } = await catalog.getSong(req.params.id);
    if (!song) throw AppError.notFound('Song not found', 'SONG_NOT_FOUND');

    const qualityMap = { low: '96kbps', medium: '160kbps', high: '320kbps', veryhigh: '320kbps' };
    const wanted = quality || qualityMap[req.user?.preferences?.audioQuality] || '320kbps';
    const downloads = song.downloadUrls || [];
    const chosen = downloads.find((d) => d.quality === wanted) || catalog.bestDownload(downloads);
    if (!chosen) throw AppError.upstream('No audio source available for this song', { songId: req.params.id });

    if (mode === 'redirect') {
      return res.redirect(302, chosen.url);
    }

    // True proxy with Range passthrough (seek support).
    // WARNING: This consumes Render bandwidth.
    const headers = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) SoundWave/1.0' };
    if (req.headers.range) headers.range = req.headers.range;
    const upstream = await fetch(chosen.url, { headers });
    if (!upstream.ok && upstream.status !== 206) throw AppError.upstream(`Audio CDN responded ${upstream.status}`);

    res.status(upstream.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.setHeader('X-Audio-Quality', chosen.quality);
    res.setHeader('X-Bandwidth-Warning', 'proxy-mode-in-use'); // A15-8
    if (!upstream.body) return res.end();
    return Readable.fromWeb(upstream.body).pipe(res);
  })
);

module.exports = router;
