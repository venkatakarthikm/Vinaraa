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

/** Public browse endpoints work anonymously; personalised ones use optionalAuth. */
router.use(optionalAuth);

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
        const result = await catalog.searchSongs(q, { page, limit, language });
        await record();
        const songs = await Song.find({ saavnId: { $in: (result.results || []).map((r) => String(r.id)).filter(Boolean) } }).lean();
        const map = new Map(songs.map((x) => [x.saavnId, x]));
        const items = (result.results || []).map((r) => {
          const local = map.get(String(r.id));
          return local ? catalog.toClientSong(local) : catalog.toClientSong(catalog.normalizeSong(r));
        });
        
        // Persist the upstream ones
        const upstreamRaw = (result.results || []).filter(r => !map.has(String(r.id)));
        if (upstreamRaw.length) {
          catalog.persistSongs(upstreamRaw).catch(() => {});
        }
        
        return paginated(res, items, { page, limit, total: result.total || items.length, extra: { scope: 'songs', stale: result.stale, upstream: result.upstream } });
      }
      const result = await catalog.searchGeneric(type, q, { page, limit });
      await record();
      return paginated(res, result.results || [], { page, limit, total: result.total || 0, extra: { scope: type, stale: result.stale } });
    }

    const [songs, albums, artists, playlists] = await Promise.allSettled([
      catalog.searchSongs(q, { page, limit, language }),
      catalog.searchGeneric('albums', q, { page, limit: Math.min(limit, 10) }),
      catalog.searchGeneric('artists', q, { page, limit: Math.min(limit, 10) }),
      catalog.searchGeneric('playlists', q, { page, limit: Math.min(limit, 10) }),
    ]);
    await record();
    
    if (songs.status === 'fulfilled' && songs.value.results?.length) {
      catalog.persistSongs(songs.value.results).catch(() => {});
    }

    const unwrap = (r, key) => (r.status === 'fulfilled' ? r.value[key] : []);
    const failures = [songs, albums, artists, playlists].filter((r) => r.status === 'rejected').length;
    if (failures === 4) throw AppError.upstream('Search is temporarily unavailable — all upstream hosts failed', { query: q });

    return ok(res, {
      query: q,
      songs: unwrap(songs, 'results').map((r) => catalog.toClientSong(catalog.normalizeSong(r))),
      albums: unwrap(albums, 'results'),
      artists: unwrap(artists, 'results'),
      playlists: unwrap(playlists, 'results'),
      partial: failures > 0,
    });
  })
);

/** Type-ahead suggestions: local catalogue first (instant, offline-safe). */
router.get(
  '/search/suggestions',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return ok(res, { query: q, suggestions: [] });
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [songs, entities] = await Promise.all([
      Song.find({ name: rx }).sort({ 'metrics.trendingScore': -1, playCount: -1 }).limit(8).select('saavnId name images artists singers durationMs album language').lean(),
      require('../models/Entity').find({ name: rx }).sort({ 'metrics.popularity': -1 }).limit(6).select('entityId name type image').lean(),
    ]);
    const history = req.user
      ? await SearchHistory.find({ user: req.user._id, query: rx }).sort({ createdAt: -1 }).limit(5).lean()
      : [];
    return ok(res, {
      query: q,
      suggestions: [
        ...history.map((h) => ({ type: 'history', text: h.query })),
        ...songs.map((x) => ({ type: 'song', id: x.saavnId, text: x.name, subtitle: (x.singers || []).map((a) => a.name).join(', '), image: x.images?.[x.images.length - 1]?.url })),
        ...entities.map((e) => ({ type: e.type, id: e.entityId, text: e.name, image: e.image })),
      ],
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
    // The upstream has a known bug returning plain text for some artist ids —
    // fall back to our own catalogue so this endpoint never 500s.
    const localEntity = await require('../models/Entity').findOne({ entityId: String(req.params.id) }).lean();
    const localSongs = await Song.find({ $or: [{ 'singers.id': String(req.params.id) }, { 'musicDirectors.id': String(req.params.id) }] })
      .sort({ 'metrics.trendingScore': -1, playCount: -1 })
      .limit(50)
      .lean();

    let upstreamArtist = null;
    let stale = false;
    try {
      const result = await catalog.getArtist(req.params.id);
      upstreamArtist = result.artist;
      stale = result.stale;
    } catch (err) {
      if (!localEntity && !localSongs.length) throw AppError.upstream('Artist unavailable and not in catalogue', { err: err.message });
    }

    const merged = new Map(localSongs.map((x) => [x.saavnId, x]));
    const upstreamPool = [...(upstreamArtist?.topSongs || []), ...(upstreamArtist?.singles || [])];
    const normalizedPool = upstreamPool.map((r) => catalog.normalizeSong(r)).filter(Boolean);

    return ok(res, {
      id: String(req.params.id),
      name: catalog.decode(upstreamArtist?.name || localEntity?.name || ''),
      role: upstreamArtist?.role || localEntity?.role,
      image: catalog.maxQualityImage(upstreamArtist?.image || []) || localEntity?.image,
      followerCount: upstreamArtist?.followerCount || localEntity?.followerCount || 0,
      bio: upstreamArtist?.bio || localEntity?.description,
      topSongs: [...merged.values()].map((x) => catalog.toClientSong(x)).slice(0, 30),
      upstreamTopSongs: normalizedPool.map((x) => catalog.toClientSong(x)).slice(0, 30),
      albums: (upstreamArtist?.topAlbums || []).map((a) => ({ id: String(a.id), name: catalog.decode(a.name), year: a.year, image: catalog.maxQualityImage(a.image || []), songCount: a.songCount })),
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
    const { quality, mode } = req.query;
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
    if (!upstream.body) return res.end();
    return Readable.fromWeb(upstream.body).pipe(res);
  })
);

module.exports = router;
