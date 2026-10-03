'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const saavn = require('./saavnClient');
const cache = require('./cache');
const Song = require('../models/Song');
const Entity = require('../models/Entity');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CATALOGUE LAYER — normalisation, persistence and the entity graph
 * ─────────────────────────────────────────────────────────────────────────────
 * The upstream is the source of truth for *raw* metadata; MongoDB is the source
 * of truth for *our* view of it (last known good copy + counters).
 *
 * Every upstream payload is normalised into the same internal song shape and
 * persisted, so:
 *   • the app keeps working (search suggestions, playlists, history, entity
 *     pages) when a worker URL dies or is rotating;
 *   • recommendations can query OUR entity indexes (movie → hero → language →
 *     singer → director) instead of hammering the upstream.
 *
 * Entity mapping from the upstream song.artists.all[]:
 *   primary_artists  → singers   (the artists you see on the card)
 *   music            → music director / composer   ← "music director"
 *   starring         → actors    (hero / cast)     ← "hero"
 *   lyricist         → lyricists
 * `artists.primary[]` is always folded into singers as well.
 */

/* ── helpers ──────────────────────────────────────────────────────────────── */

const ENTITIES = {
  '&amp;': '&', '&quot;': '"', '&#039;': "'", '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
};

/** JioSaavn returns HTML-escaped names ("Tere &quot;Hawa&quot;"). Decode once, centrally. */
const decode = (v) => (typeof v === 'string' ? v.replace(/&amp;|&quot;|&#039;|&apos;|&lt;|&gt;|&nbsp;/g, (m) => ENTITIES[m] ?? m).replace(/\s+/g, ' ').trim() : v);

const maxQualityImage = (images = []) => {
  const order = ['500x500', '150x150', '50x50'];
  const pick = (q) => images.find((i) => i?.quality === q)?.url;
  return decode(order.map(pick).find(Boolean) || images[images.length - 1]?.url || images[0]?.url || '');
};

const imageByQuality = (images = [], quality = '150x150') => decode(images.find((i) => i?.quality === quality)?.url || images[0]?.url || '');

/** Prefers 320kbps, guarantees https, keeps the whole ladder for the app. */
function normalizeDownloads(downloadUrl = []) {
  const byBitrate = { '12kbps': 12, '48kbps': 48, '96kbps': 96, '160kbps': 160, '320kbps': 320 };
  return downloadUrl
    .filter((d) => d && d.url)
    .map((d) => {
      const bitrate = byBitrate[d.quality] || Number(String(d.quality).replace(/\D/g, '')) || 96;
      return { quality: d.quality, bitrate, url: String(d.url).replace(/^http:/, 'https:'), format: /\.m4a|\.mp4/i.test(d.url) ? 'm4a' : 'mp3' };
    })
    .sort((a, b) => a.bitrate - b.bitrate);
}

function bestDownload(downloads = []) {
  // Pick by the user's audio-quality preference when we have it available upstream.
  return downloads.find((d) => d.bitrate === 320) || downloads.find((d) => d.bitrate === 160) || downloads[downloads.length - 1] || null;
}

/** Flattens the upstream role buckets into our five recommendation entities. */
function extractEntities(artists = {}) {
  const all = Array.isArray(artists.all) ? artists.all : [];
  const primary = Array.isArray(artists.primary) ? artists.primary : [];
  const featured = Array.isArray(artists.featured) ? artists.featured : [];

  const rel = (a) => ({ id: String(a.id), name: decode(a.name), role: a.role, image: maxQualityImage(a.image || []) });

  const byRole = (r) => all.filter((a) => String(a.role || '').toLowerCase() === r).map(rel);
  const singers = [...primary.map(rel), ...featured.map(rel), ...byRole('singer'), ...byRole('primary_artists'), ...byRole('featured_artists')];
  const musicDirectors = [...byRole('music'), ...byRole('music_director')];
  const actors = [...byRole('starring'), ...byRole('actor'), ...byRole('actors')];
  const lyricists = [...byRole('lyricist'), ...byRole('lyrics')];

  // De-duplicate by id, keeping the order of importance.
  const uniq = (arr) => {
    const seen = new Set();
    return arr.filter((x) => x.id && !seen.has(x.id) && seen.add(x.id));
  };

  return {
    singers: uniq(singers),
    musicDirectors: uniq(musicDirectors),
    actors: uniq(actors),
    lyricists: uniq(lyricists),
    all: (all.length ? all : [...primary, ...featured]).map(rel),
  };
}

/** Upstream song JSON → internal normalised song. Never invents a field. */
function normalizeSong(raw) {
  if (!raw || !raw.id) return null;
  const e = extractEntities(raw.artists || {});
  const downloads = normalizeDownloads(raw.downloadUrl || []);
  const durationMs = Number(raw.duration) > 0 ? Number(raw.duration) * 1000 : 0;

  return {
    saavnId: String(raw.id),
    name: decode(raw.name) || 'Unknown',
    subtitle: decode(raw.subtitle) || '',
    type: raw.type || 'song',
    year: raw.year ? String(raw.year) : raw.releaseDate ? String(raw.releaseDate).slice(0, 4) : undefined,
    releaseDate: raw.releaseDate ? new Date(raw.releaseDate) : undefined,
    durationMs,
    language: (raw.language || '').toLowerCase() || undefined,
    label: decode(raw.label) || undefined,
    copyright: decode(raw.copyright) || undefined,
    explicitContent: Boolean(raw.explicitContent),
    playCount: Number(raw.playCount) || 0,
    hasLyrics: Boolean(raw.hasLyrics),
    lyricsId: raw.lyricsId || undefined,
    saavnUrl: raw.url || undefined,
    album: raw.album
      ? { id: String(raw.album.id || ''), name: decode(raw.album.name), url: raw.album.url, year: raw.album.year ? String(raw.album.year) : undefined }
      : undefined,
    singers: e.singers.map(({ id, name }) => ({ id, name })),
    musicDirectors: e.musicDirectors.map(({ id, name }) => ({ id, name })),
    actors: e.actors.map(({ id, name }) => ({ id, name })),
    lyricists: e.lyricists.map(({ id, name }) => ({ id, name })),
    artists: e.all.map((a) => ({ id: a.id, name: a.name, role: a.role, image: a.image ? [{ quality: '500x500', url: a.image }] : [] })),
    primaryArtistIds: e.singers.map((s) => s.id),
    images: (raw.image || []).map((i) => ({ quality: i.quality, url: String(i.url || '').replace(/^http:/, 'https:') })),
    downloadUrls: downloads,
    lastFetchedAt: new Date(),
  };
}

/** Public (client-facing) song shape — stable contract for the Android app. */
function toClientSong(song, opts = {}) {
  if (!song) return null;
  const s = song.toObject ? song.toObject() : song;
  const images = s.images || [];
  const downloads = s.downloadUrls || [];
  const best = opts.quality
    ? downloads.find((d) => d.quality === opts.quality) || bestDownload(downloads)
    : bestDownload(downloads);

  const artistsText = [s.subtitle, ...(s.singers || []).map((a) => a.name)].filter(Boolean).join(', ') || (s.singers || []).map((a) => a.name).join(', ');
  return {
    id: s.saavnId,
    name: s.name,
    title: s.name,
    subtitle: s.subtitle || undefined,
    artistsText,
    singers: s.singers || [],
    musicDirectors: s.musicDirectors || [],
    actors: s.actors || [],
    year: s.year,
    releaseDate: s.releaseDate,
    durationMs: s.durationMs,
    durationText: s.durationMs ? `${Math.floor(s.durationMs / 60000)}:${String(Math.floor((s.durationMs % 60000) / 1000)).padStart(2, '0')}` : undefined,
    language: s.language,
    label: s.label,
    explicitContent: Boolean(s.explicitContent),
    playCount: s.playCount,
    hasLyrics: Boolean(s.hasLyrics),
    url: s.saavnUrl,
    album: s.album ? { id: s.album.id, name: s.album.name, movieName: s.album.name, url: s.album.url, year: s.album.year } : undefined,
    image: maxQualityImage(images),
    artwork: {
      small: imageByQuality(images, '50x50'),
      medium: imageByQuality(images, '150x150'),
      large: imageByQuality(images, '500x500'),
    },
    audio: {
      best: best ? best.url : undefined,
      quality: best ? best.quality : undefined,
      formats: downloads.map((d) => ({ quality: d.quality, bitrate: d.bitrate, url: d.url, format: d.format })),
      // This is the proxy route. It costs Render bandwidth. Do NOT use this for normal playback.
      // Use audio.best instead which points directly to the CDN.
      streamUrl: `${env.SERVER_URL || 'https://vinaraa.onrender.com'}/api/v1/music/stream/${s.saavnId}${opts.quality ? `?quality=${opts.quality}` : ''}`,
      // Absolute CDN URLs, all qualities, so the downloader never needs Render
      downloadUrlsPreview: downloads.map((d) => ({ quality: d.quality, bitrate: d.bitrate, url: d.url, format: d.format })),
      requiresAuth: true,
      canDownload: true,
    },
    metrics: s.metrics || undefined,
  };
}

/* ── persistence ──────────────────────────────────────────────────────────── */

/** Upserts normalised songs in bulk and mirrors their entities into Entity. */
async function persistSongs(rawSongs = [], { keepRaw = false } = {}) {
  const normalized = rawSongs.map(normalizeSong).filter(Boolean);
  if (!normalized.length) return { songs: [], saved: 0 };

  const ops = normalized.map((s) => ({
    updateOne: {
      filter: { saavnId: s.saavnId },
      update: { $set: { ...s, ...(keepRaw ? {} : {}) }, $inc: { fetchCount: 1 } },
      upsert: true,
    },
  }));
  const res = await Song.bulkWrite(ops, { ordered: false }).catch((err) => {
    logger.warn('song bulk upsert partial failure', { err: err.message });
    return { upsertedCount: 0, modifiedCount: 0 };
  });

  // Mirror entities for the onboarding pickers + entity pages.
  const entityOps = [];
  const push = (e, type, extra = {}) => {
    if (!e?.id) return;
    entityOps.push({
      updateOne: {
        filter: { type, entityId: e.id },
        update: {
          $set: { name: e.name, image: e.image || undefined, subtitle: extra.subtitle, language: extra.language, lastFetchedAt: new Date() },
          $setOnInsert: { metrics: { popularity: 0 } },
        },
        upsert: true,
      },
    });
  };
  for (const s of normalized) {
    for (const a of s.singers) push(a, 'artist', { language: s.language });
    for (const a of s.musicDirectors) push(a, 'musicDirector', { subtitle: 'Music Director', language: s.language });
    for (const a of s.actors) push(a, 'actor', { subtitle: 'Actor', language: s.language });
    if (s.album?.id) push({ id: s.album.id, name: s.album.name }, 'album', { subtitle: s.year, language: s.language });
  }
  if (entityOps.length) await Entity.bulkWrite(entityOps, { ordered: false }).catch(() => {});

  return { songs: normalized, saved: (res.upsertedCount || 0) + (res.modifiedCount || 0) };
}

/** Local-first read, upstream refresh behind a TTL cache. */
async function getSong(id, { refresh = false, quality } = {}) {
  const key = id;
  const local = await Song.findOne({ saavnId: id });
  if (local && !refresh && local.lastFetchedAt && Date.now() - new Date(local.lastFetchedAt).getTime() < env.CACHE_TTL_SONG * 1000) {
    return { song: local, upstream: { cached: true, host: 'local-catalogue' } };
  }

  const { value, stale, error } = await cache
    .swr('song', key, env.CACHE_TTL_SONG, async () => {
      const { data, upstream } = await saavn.songsById(id);
      const list = Array.isArray(data.data) ? data.data : [data.data];
      const normal = list.filter(Boolean);
      await persistSongs(normal);
      return { raw: normal, upstream };
    }, 'song')
    .catch((err) => {
      if (!local) throw err;
      logger.info('serving song from local catalogue', { id, err: err.message });
      return { value: { raw: null, upstream: { cached: true, offline: true } }, stale: true, error: err.message };
    });

  if (!value?.raw) {
    if (!local) throw AppError.upstream('Song unavailable and not in local catalogue', { id });
    return { song: local, upstream: { cached: true, offline: true, error } };
  }

  const raw = value.raw.find((r) => String(r.id) === String(id)) || value.raw[0];
  const normalized = normalizeSong(raw);
  const doc = await Song.findOneAndUpdate({ saavnId: id }, { $set: normalized, $inc: { fetchCount: 1 } }, { new: true, upsert: true });
  return { song: doc, upstream: { ...value.upstream, stale: Boolean(stale) } };
}

async function getSongs(ids = []) {
  const wanted = [...new Set(ids.filter(Boolean).map(String))];
  if (!wanted.length) return { songs: [], upstream: null };
  const local = await Song.find({ saavnId: { $in: wanted } });
  const localById = new Map(local.map((s) => [s.saavnId, s]));
  const missing = wanted.filter((id) => !localById.has(id));

  let upstream = null;
  if (missing.length) {
    try {
      const res = await saavn.songsByIds(missing);
      const rawList = (Array.isArray(res.data.data) ? res.data.data : [res.data.data]).filter(Boolean);
      await persistSongs(rawList);
      const fresh = await Song.find({ saavnId: { $in: missing } });
      fresh.forEach((s) => localById.set(s.saavnId, s));
      upstream = res.upstream;
    } catch (err) {
      logger.warn('bulk song fetch failed, using local catalogue only', { err: err.message, missing: missing.length });
    }
  }
  return { songs: wanted.map((id) => localById.get(id)).filter(Boolean), upstream };
}

/** Upstream search with caching + persistence; degrades to local text search. */
async function searchSongs(query, { page = 0, limit = 20, language } = {}) {
  const key = { query: query.toLowerCase(), page, limit, language };
  try {
    const { value, stale } = await cache.swr('search:songs', key, env.CACHE_TTL_SEARCH, async () => {
      const { data, upstream } = await saavn.searchSongs(query, page, limit);
      const results = data?.data?.results || [];
      await persistSongs(results);
      return { total: data?.data?.total || results.length, start: data?.data?.start || 0, results, upstream };
    }, 'search:songs');
    return { ...value, stale: Boolean(stale) };
  } catch (err) {
    logger.warn('song search upstream failed — falling back to local catalogue', { query, err: err.message });
    const local = await Song.find(
      { $text: { $search: query }, ...(language ? { language } : {}) },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .lean();
    if (!local.length) throw err;
    return { total: local.length, start: 0, results: local, upstream: { cached: true, offline: true }, stale: true, degraded: true };
  }
}

async function searchGeneric(kind, query, { page = 0, limit = 20 } = {}) {
  const fn = { albums: saavn.searchAlbums, artists: saavn.searchArtists, playlists: saavn.searchPlaylists }[kind];
  if (!fn) throw AppError.badRequest(`Unknown search scope: ${kind}`);
  const key = { query: query.toLowerCase(), page, limit };
  const { value, stale } = await cache.swr(`search:${kind}`, key, env.CACHE_TTL_SEARCH, async () => {
    const { data, upstream } = await fn(query, page, limit);
    const d = data?.data || {};
    const results = d.results || d;
    return { total: d.total || (Array.isArray(results) ? results.length : 0), start: d.start || 0, results, upstream };
  }, `search:${kind}`);
  return { ...value, stale: Boolean(stale) };
}

/* ── Autocomplete normalizers ────────────────────────────────────────────── */

function normalizeAutocompleteAlbum(raw) {
  if (!raw || !raw.id) return null;
  const year = raw.more_info?.year || (raw.description ? (raw.description.match(/\b(19|20)\d{2}\b/)?.[0]) : undefined);
  const language = raw.more_info?.language || undefined;
  const songCount = raw.more_info?.song_pids ? raw.more_info.song_pids.split(',').map(s => s.trim()).filter(Boolean).length : undefined;
  const rawImg = raw.image || '';
  const imgUrl = rawImg ? rawImg.replace('-50x50', '-500x500') : '';
  const nameDecoded = decode(raw.title || raw.name) || 'Unknown Album';

  return {
    id: String(raw.id),
    name: nameDecoded,
    title: nameDecoded,
    subtitle: raw.description ? decode(raw.description) : undefined,
    type: 'album',
    year: year ? String(year) : undefined,
    language,
    songCount,
    image: imgUrl || maxQualityImage([{ quality: '500x500', url: imgUrl }]),
    artwork: {
      small: imgUrl ? imgUrl.replace('-500x500', '-50x50') : '',
      medium: imgUrl ? imgUrl.replace('-500x500', '-150x150') : '',
      large: imgUrl,
    },
    url: raw.url || undefined,
  };
}

function normalizeAutocompleteSong(raw) {
  if (!raw || !raw.id) return null;
  const rawImg = raw.image || '';
  const imgUrl = rawImg ? rawImg.replace('-50x50', '-500x500') : '';
  const nameDecoded = decode(raw.title || raw.name) || 'Unknown';
  const singersText = raw.more_info?.singers || raw.more_info?.primary_artists || raw.description || '';

  return {
    id: String(raw.id),
    saavnId: String(raw.id),
    name: nameDecoded,
    title: nameDecoded,
    subtitle: raw.description ? decode(raw.description) : undefined,
    artistsText: decode(singersText),
    singers: (singersText || '').split(',').map(s => ({ id: '', name: decode(s.trim()) })).filter(x => x.name),
    language: raw.more_info?.language || undefined,
    album: raw.album ? { id: '', name: decode(raw.album), movieName: decode(raw.album) } : undefined,
    image: imgUrl || maxQualityImage([{ quality: '500x500', url: imgUrl }]),
    artwork: {
      small: imgUrl ? imgUrl.replace('-500x500', '-50x50') : '',
      medium: imgUrl ? imgUrl.replace('-500x500', '-150x150') : '',
      large: imgUrl,
    },
    url: raw.url || undefined,
    audio: {
      best: raw.more_info?.vlink || undefined,
      requiresAuth: true,
      canDownload: true,
    },
  };
}

function normalizeAutocompleteArtist(raw) {
  if (!raw || !raw.id) return null;
  const rawImg = raw.image || '';
  const imgUrl = rawImg ? rawImg.replace('-50x50', '-500x500') : '';
  const nameDecoded = decode(raw.title || raw.name) || 'Unknown Artist';
  return {
    id: String(raw.id),
    name: nameDecoded,
    title: nameDecoded,
    type: 'artist',
    role: raw.description ? decode(raw.description) : (raw.extra || 'Artist'),
    image: imgUrl || maxQualityImage([{ quality: '500x500', url: imgUrl }]),
  };
}

function normalizeAutocompletePlaylist(raw) {
  if (!raw || !raw.id) return null;
  const rawImg = raw.image || '';
  const imgUrl = rawImg ? rawImg.replace('-50x50', '-500x500') : '';
  const nameDecoded = decode(raw.title || raw.name) || 'Unknown Playlist';
  return {
    id: String(raw.id),
    name: nameDecoded,
    title: nameDecoded,
    type: 'playlist',
    image: imgUrl || maxQualityImage([{ quality: '500x500', url: imgUrl }]),
  };
}

async function autocomplete(query) {
  const q = String(query || '').trim();
  if (!q) return { albums: [], songs: [], artists: [], playlists: [] };

  const { value, stale } = await cache.swr('autocomplete', q.toLowerCase(), env.CACHE_TTL_SEARCH || 300, async () => {
    const { data } = await saavn.autocomplete(q);
    const d = data || {};
    const albums = (d.albums?.data || []).map(normalizeAutocompleteAlbum).filter(Boolean);
    const songs = (d.songs?.data || []).map(normalizeAutocompleteSong).filter(Boolean);
    const artists = (d.artists?.data || []).map(normalizeAutocompleteArtist).filter(Boolean);
    const playlists = (d.playlists?.data || []).map(normalizeAutocompletePlaylist).filter(Boolean);

    if (albums.length) {
      const entityOps = albums.map((a) => ({
        updateOne: {
          filter: { type: 'album', entityId: a.id },
          update: {
            $set: { name: a.name, subtitle: a.year, language: a.language, image: a.image, songCount: a.songCount, lastFetchedAt: new Date() },
            $setOnInsert: { metrics: { popularity: 0 } },
          },
          upsert: true,
        },
      }));
      Entity.bulkWrite(entityOps, { ordered: false }).catch(() => {});
    }

    return { albums, songs, artists, playlists };
  }, 'autocomplete');

  return { ...value, stale: Boolean(stale) };
}

async function getAlbum(id, { page = 0 } = {}) {
  const { value, stale } = await cache.swr('album', { id, page }, env.CACHE_TTL_ENTITY, async () => {
    const { data, upstream } = await saavn.albumById(id);
    const album = Array.isArray(data.data) ? data.data.find((a) => String(a.id) === String(id)) || data.data[0] : data.data;
    const albumSongs = album?.songs || album?.list || [];
    if (albumSongs.length) await persistSongs(albumSongs);
    if (album) {
      await Entity.updateOne(
        { type: 'album', entityId: String(album.id) },
        {
          $set: {
            name: decode(album.name), subtitle: album.year ? String(album.year) : undefined, language: album.language, image: maxQualityImage(album.image || []),
            songCount: album.songCount || album.songs?.length || 0, lastFetchedAt: new Date(),
          },
        },
        { upsert: true }
      ).catch(() => {});
    }
    return { album, upstream };
  }, 'album');
  return { ...value, stale: Boolean(stale) };
}

async function resolveAlbumLink(link) {
  const { data, upstream } = await saavn.albumByLink(link);
  const album = Array.isArray(data.data) ? data.data[0] : data.data;
  if (!album || !album.id) throw AppError.notFound('Album not found or link invalid');
  return { id: String(album.id), upstream };
}

async function getArtist(id, { page = 0, songCount = 50, albumCount = 50 } = {}) {
  const { value, stale } = await cache.swr('artist', { id, page, songCount, albumCount }, env.CACHE_TTL_ENTITY, async () => {
    const { data, upstream } = await saavn.artistById(id, page, songCount, albumCount);
    const artist = data.data;
    const pool = [...(artist?.topSongs || []), ...(artist?.singles || []), ...(artist?.topAlbums || []).flatMap((a) => a.songs || [])];
    if (pool.length) await persistSongs(pool);
    if (artist) {
      const type = (artist.role || '').toLowerCase().includes('music') ? 'musicDirector' : 'artist';
      await Entity.updateOne(
        { type, entityId: String(artist.id) },
        { $set: { name: decode(artist.name), image: maxQualityImage(artist.image || []), followerCount: artist.followerCount || 0, lastFetchedAt: new Date() } },
        { upsert: true }
      ).catch(() => {});
    }
    return { artist, upstream };
  }, 'artist');
  return { ...value, stale: Boolean(stale) };
}

async function getPlaylist(id, { limit = 100 } = {}) {
  const { value, stale } = await cache.swr('playlist', { id, limit }, env.CACHE_TTL_ENTITY, async () => {
    const { data, upstream } = await saavn.playlistById(id, limit);
    const pl = data.data;
    if (pl?.songs?.length) await persistSongs(pl.songs);
    return { playlist: pl, upstream };
  }, 'playlist');
  return { ...value, stale: Boolean(stale) };
}

async function getLyrics(id) {
  const { value, stale } = await cache.swr('lyrics', id, env.CACHE_TTL_ENTITY * 6, async () => {
    let lyrics = null, upstream = null;
    try {
      const res = await saavn.songLyrics(id);
      upstream = res?.upstream;
      lyrics = res?.data?.lyrics || null;
    } catch (e) {}

    if (!lyrics) {
      try {
        const song = await Song.findOne({ saavnId: id }).lean();
        if (song?.name) {
          const artist = (song.singers?.[0]?.name || '').split(',')[0].trim();
          const clean = String(song.name)
            .replace(/\(From\s+"[^"]*"\)/gi, '')
            .replace(/\s*[\(\[].*?[\)\]]/g, '')
            .trim();
          const q = (n) => 'https://lrclib.net/api/search?'
            + `track_name=${encodeURIComponent(n)}&artist_name=${encodeURIComponent(artist)}`;
          const r = await fetch(q(clean || song.name), {
            headers: { 'user-agent': 'Vinaraa/1.0 (https://vinaraa.onrender.com)' }
          });
          let hits = await r.json();
          if (!Array.isArray(hits) || !hits.length) {
            const r2 = await fetch(q(song.name), {
              headers: { 'user-agent': 'Vinaraa/1.0 (https://vinaraa.onrender.com)' }
            });
            hits = await r2.json();
          }
          if (Array.isArray(hits) && hits.length) {
            const durMs = song.durationMs || 0;
            const byDur = hits.find((x) => x.duration && durMs &&
              Math.abs(x.duration * 1000 - durMs) <= 3000 && (x.syncedLyrics || x.plainLyrics));
            const hit = byDur || hits.find((x) => x.syncedLyrics)
                      || hits.find((x) => x.plainLyrics);
            lyrics = hit?.syncedLyrics || hit?.plainLyrics || null;
          }
        }
      } catch (e) {}
    }
    return { lyrics: lyrics || null, upstream };
  }, 'lyrics');
  return { ...value, stale: Boolean(stale) };
}

/** Home modules (upstream editorial rails) with a language filter. */
async function getModules(languages = ['hindi'], { limit = 10 } = {}) {
  const key = { languages: [...languages].sort().join(','), limit };
  const { value, stale } = await cache.swr('modules', key, env.CACHE_TTL_ENTITY, async () => {
    const { data, upstream } = await saavn.modules(languages.join(','));
    const d = data.data || {};
    const rails = [];
    // The upstream returns {albums:[], playlists:[], charts:[], trending:[], ...}
    for (const [key2, list] of Object.entries(d)) {
      if (!Array.isArray(list) || !list.length) continue;
      const songs = list.filter((x) => x.type === 'song' || x.downloadUrl).slice(0, limit);
      if (songs.length) {
        await persistSongs(songs);
        const clientItems = songs.map(s => toClientSong(normalizeSong(s))).filter(Boolean);
        rails.push({ key: key2, title: key2.replace(/^\w/, (c) => c.toUpperCase()), type: 'songs', items: clientItems });
      }
    }
    // Some deployments return a flat array of playlists/albums instead.
    if (!rails.length && Array.isArray(d)) rails.push({ key: 'all', title: 'Trending', type: 'mixed', items: d.slice(0, limit) });
    return { languages, rails, upstream };
  }, 'modules');
  return { ...value, stale: Boolean(stale) };
}

/** Candidate pool straight from OUR indexes — the recommendation engine's fuel. */
async function localCandidates({ language, singerIds, directorIds, actorIds, albumIds, excludeIds = [], limit = 200, minTrending = 0 }) {
  const filter = {};
  const or = [];
  if (language) or.push({ language });
  if (singerIds?.length) or.push({ 'singers.id': { $in: singerIds } });
  if (directorIds?.length) or.push({ 'musicDirectors.id': { $in: directorIds } });
  if (actorIds?.length) or.push({ 'actors.id': { $in: actorIds } });
  if (albumIds?.length) or.push({ 'album.id': { $in: albumIds } });
  if (or.length) filter.$or = or;
  if (excludeIds.length) filter.saavnId = { $nin: excludeIds };
  if (minTrending) filter['metrics.trendingScore'] = { $gte: minTrending };
  const docs = await Song.find(filter).sort({ 'metrics.trendingScore': -1, playCount: -1 }).limit(limit).lean();
  return docs;
}

/** Trending from our own counters (works offline). */
async function trendingFromCatalogue({ language, limit = 30 } = {}) {
  const filter = { 'metrics.trendingScore': { $gt: 0 } };
  if (language) filter.language = language;
  const docs = await Song.find(filter).sort({ 'metrics.trendingScore': -1, 'metrics.ourPlays': -1 }).limit(limit).lean();
  if (docs.length) return docs;
  return Song.find({ ...(language ? { language } : {}) }).sort({ playCount: -1 }).limit(limit).lean();
}

/** Bulk refresh of a set of songs (used by "On repeat"/refresh jobs). */
async function refreshStaleSongs(limit = 25) {
  const stale = await Song.find({ lastFetchedAt: { $lt: new Date(Date.now() - env.CACHE_TTL_SONG * 1000) } })
    .sort({ 'metrics.trendingScore': -1 })
    .limit(limit)
    .select('saavnId')
    .lean();
  if (!stale.length) return { refreshed: 0 };
  const { songs } = await getSongs(stale.map((s) => s.saavnId));
  return { refreshed: songs.length };
}

module.exports = {
  decode,
  normalizeSong,
  normalizeAutocompleteAlbum,
  normalizeAutocompleteSong,
  normalizeAutocompleteArtist,
  normalizeAutocompletePlaylist,
  autocomplete,
  toClientSong,
  persistSongs,
  getSong,
  getSongs,
  getAlbum,
  resolveAlbumLink,
  getArtist,
  getPlaylist,
  getLyrics,
  getModules,
  searchSongs,
  searchGeneric,
  localCandidates,
  trendingFromCatalogue,
  refreshStaleSongs,
  bestDownload,
  maxQualityImage,
  imageByQuality,
};
