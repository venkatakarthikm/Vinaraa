'use strict';

const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const User = require('../models/User');
const catalog = require('./catalog');
const cache = require('./cache');

/**
 * Playlists.
 *
 * "Save" button behaviour requested by the user:
 *   • no name given  → auto-name "Playlist 1", "Playlist 2", … (per user)
 *   • name given     → use it, de-duplicated as "Name (2)" if needed
 *   • liking a song  → mirrored into the system playlist "Liked Songs"
 */

const SYSTEM = {
  liked: { key: 'liked_songs', name: 'Liked Songs', description: 'Everything you have hearted' },
  onRepeat: { key: 'on_repeat', name: 'On Repeat', description: 'Your most replayed tracks right now' },
  tasteMix: { key: 'taste_mix', name: 'Your Taste Mix', description: 'Built from your movies, heroes, singers and directors' },
  recentlyAdded: { key: 'recently_added', name: 'Recently Added', description: 'The newest songs in your library' },
};

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Snapshot of a song as stored inside a playlist (renders offline). */
function toTrack(song, extra = {}) {
  const s = song.toObject ? song.toObject() : song;
  const images = s.images || [];
  return {
    songId: s.saavnId,
    name: s.name,
    subtitle: s.subtitle,
    artistsText: (s.singers || []).map((x) => x.name).join(', '),
    image: catalog.maxQualityImage(images) || extra.image,
    durationMs: s.durationMs || 0,
    language: s.language,
    albumName: s.album?.name,
    movieName: s.album?.name,
    year: s.year,
    source: extra.source || 'manual',
    addedAt: new Date(),
    ...extra,
  };
}

async function nextPlaylistName(owner) {
  // Derived from the user's lifetime counter, then verified for collisions.
  const user = await User.findById(owner).select('stats').lean();
  let n = (user?.stats?.playlistsCreated || 0) + 1;
  for (let i = 0; i < 50; i += 1) {
    const candidate = `Playlist ${n}`;
    const exists = await Playlist.exists({ owner, name: candidate, deletedAt: null });
    if (!exists) return candidate;
    n += 1;
  }
  return `Playlist ${Date.now()}`;
}

async function uniqueName(owner, baseName) {
  let name = String(baseName).trim().slice(0, 120) || 'Playlist';
  let attempt = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Playlist.exists({ owner, name, deletedAt: null })) {
    name = `${String(baseName).trim().slice(0, 110)} (${attempt})`;
    attempt += 1;
    if (attempt > 60) break;
  }
  return name;
}

async function create(owner, { name, description, visibility = 'private', isSystem = false, systemKey, trackIds = [], coverImageUrl } = {}) {
  const finalName = name && String(name).trim() ? await uniqueName(owner, name) : await nextPlaylistName(owner);

  const playlist = new Playlist({
    owner,
    name: finalName,
    slug: slugify(finalName),
    description: description || '',
    visibility,
    isSystem,
    systemKey,
    coverImageUrl,
  });

  if (trackIds.length) {
    const songs = await resolveSongs(trackIds);
    playlist.tracks = songs.map((s) => toTrack(s));
    playlist.recalculate();
  }

  await playlist.save();
  if (!isSystem) {
    await User.updateOne({ _id: owner }, { $inc: { 'stats.playlistsCreated': 1 } }).catch(() => {});
  }
  return playlist;
}

/** Accepts ids that exist locally, fetching the missing ones from the upstream. */
async function resolveSongs(ids = []) {
  const wanted = [...new Set(ids.filter(Boolean).map(String))];
  if (!wanted.length) return [];
  const local = await Song.find({ saavnId: { $in: wanted } });
  const have = new Set(local.map((s) => s.saavnId));
  const missing = wanted.filter((id) => !have.has(id));
  if (missing.length) {
    try {
      const { songs } = await catalog.getSongs(missing);
      songs.forEach((s) => {
        if (!have.has(s.saavnId)) {
          local.push(s);
          have.add(s.saavnId);
        }
      });
    } catch (err) {
      logger.warn('could not fetch some songs for playlist', { err: err.message, missing: missing.length });
    }
  }
  const byId = new Map(local.map((s) => [s.saavnId, s]));
  return wanted.map((id) => byId.get(id)).filter(Boolean);
}

/** Creates the system playlists every account should have. Idempotent. */
async function ensureSystemPlaylists(user) {
  const owner = user._id || user;
  const existing = await Playlist.find({ owner, systemKey: { $in: Object.values(SYSTEM).map((s) => s.key) } }).select('systemKey').lean();
  const have = new Set(existing.map((e) => e.systemKey));
  const created = [];
  for (const def of Object.values(SYSTEM)) {
    if (have.has(def.key)) continue;
    created.push(
      await create(owner, { name: def.name, description: def.description, isSystem: true, systemKey: def.key, visibility: 'private' })
    );
  }
  return created;
}

async function getSystemPlaylist(owner, key) {
  return Playlist.findOne({ owner, systemKey: key, deletedAt: null });
}

async function list(owner, { includeSystem = true, limit = 50, page = 1, sort = '-updatedAt' } = {}) {
  const filter = { owner, deletedAt: null };
  if (!includeSystem) filter.isSystem = false;
  const [items, total] = await Promise.all([
    Playlist.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Playlist.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function get(owner, playlistId) {
  const playlist = await Playlist.findOne({ _id: playlistId, deletedAt: null });
  if (!playlist) throw AppError.notFound('Playlist not found', 'PLAYLIST_NOT_FOUND');
  const isOwner = String(playlist.owner) === String(owner._id || owner);
  const isCollaborator = (playlist.collaborators || []).some((c) => String(c) === String(owner._id || owner));
  if (!isOwner && !isCollaborator && playlist.visibility === 'private') {
    throw AppError.forbidden('This playlist is private', 'PLAYLIST_PRIVATE');
  }
  return playlist;
}

async function update(owner, playlistId, patch) {
  const playlist = await get(owner, playlistId);
  if (String(playlist.owner) !== String(owner._id || owner)) throw AppError.forbidden('Only the owner can edit this playlist');
  const allowed = ['name', 'description', 'visibility', 'isCollaborative', 'coverImageUrl'];
  for (const k of allowed) if (patch[k] !== undefined) playlist[k] = patch[k];
  if (patch.name) playlist.slug = slugify(patch.name);
  await playlist.save();
  return playlist;
}

async function remove(owner, playlistId) {
  const playlist = await get(owner, playlistId);
  if (playlist.isSystem) throw AppError.badRequest('System playlists cannot be deleted', 'SYSTEM_PLAYLIST');
  playlist.deletedAt = new Date();
  await playlist.save();
  return playlist;
}

/** Adds tracks, skipping duplicates. `ids` accepts saavn ids. */
async function addTracks(owner, playlistId, ids, { source = 'manual', position } = {}) {
  const playlist = await get(owner, playlistId);
  const songs = await resolveSongs(ids);
  if (!songs.length) throw AppError.badRequest('No valid songs to add', 'NO_SONGS');

  const existing = new Set(playlist.tracks.map((t) => t.songId));
  const fresh = songs.filter((s) => !existing.has(s.saavnId));
  const tracks = fresh.map((s) => toTrack(s, { source, addedBy: owner._id || owner }));

  if (position !== undefined && position >= 0 && position < playlist.tracks.length) {
    playlist.tracks.splice(position, 0, ...tracks);
  } else {
    playlist.tracks.push(...tracks);
  }
  playlist.recalculate();
  await playlist.save();
  return { playlist, added: tracks.length, skipped: songs.length - tracks.length };
}

async function removeTracks(owner, playlistId, songIds) {
  const playlist = await get(owner, playlistId);
  const remove = new Set(songIds.map(String));
  const before = playlist.tracks.length;
  playlist.tracks = playlist.tracks.filter((t) => !remove.has(t.songId));
  playlist.recalculate();
  await playlist.save();
  return { playlist, removed: before - playlist.tracks.length };
}

async function reorder(owner, playlistId, { from, to }) {
  const playlist = await get(owner, playlistId);
  if (from < 0 || to < 0 || from >= playlist.tracks.length || to >= playlist.tracks.length) {
    throw AppError.badRequest('Invalid reorder indexes', 'BAD_REORDER');
  }
  const [moved] = playlist.tracks.splice(from, 1);
  playlist.tracks.splice(to, 0, moved);
  playlist.recalculate();
  await playlist.save();
  return playlist;
}

/** Like / unlike, mirrored into the "Liked Songs" system playlist. */
async function toggleLike(user, songId, { like } = {}) {
  const liked = await getSystemPlaylist(user._id, SYSTEM.liked.key);
  if (!liked) throw AppError.internal('Liked Songs playlist missing');

  const already = liked.tracks.some((t) => t.songId === String(songId));
  const shouldLike = like === undefined ? !already : Boolean(like);

  if (shouldLike && !already) {
    const songs = await resolveSongs([songId]);
    if (!songs.length) throw AppError.notFound('Song not found', 'SONG_NOT_FOUND');
    liked.tracks.unshift(toTrack(songs[0], { source: 'system', addedBy: user._id }));
    liked.recalculate();
    await liked.save();
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.likedSongs': 1 } }).catch(() => {});
    await Song.updateOne({ saavnId: String(songId) }, { $inc: { 'metrics.ourLikes': 1, 'metrics.trendingScore': 8 } }).catch(() => {});
  } else if (!shouldLike && already) {
    liked.tracks = liked.tracks.filter((t) => t.songId !== String(songId));
    liked.recalculate();
    await liked.save();
    await User.updateOne({ _id: user._id }, { $inc: { 'stats.likedSongs': -1 } }).catch(() => {});
    await Song.updateOne({ saavnId: String(songId) }, { $inc: { 'metrics.ourLikes': -1, 'metrics.trendingScore': -8 } }).catch(() => {});
  }

  return { liked: shouldLike, likedSongsCount: liked.tracks.length };
}

async function isLiked(user, songId) {
  const liked = await getSystemPlaylist(user._id, SYSTEM.liked.key);
  return Boolean(liked?.tracks.some((t) => t.songId === String(songId)));
}

/**
 * Rebuilds the "On Repeat" system playlist from the user's measured history —
 * top tracks of the last 30 days, which is exactly what "on repeat" means.
 */
async function refreshOnRepeat(user, { limit = 30 } = {}) {
  const playlist = await getSystemPlaylist(user._id, SYSTEM.onRepeat.key);
  if (!playlist) return null;
  const rows = await require('../models/PlayEvent').aggregate([
    { $match: { user: user._id, listenedMs: { $gt: 0 }, createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
    { $group: { _id: '$songId', listenedMs: { $sum: '$listenedMs' }, plays: { $sum: 1 } } },
    { $sort: { listenedMs: -1 } },
    { $limit: limit },
  ]);
  const songs = await resolveSongs(rows.map((r) => String(r._id)));
  playlist.tracks = songs.map((s) => toTrack(s, { source: 'system' }));
  playlist.recalculate();
  await playlist.save();
  return playlist;
}

/** Rebuilds the "Your Taste Mix" playlist from the recommendation engine. */
async function refreshTasteMix(user, { limit = 40 } = {}) {
  const playlist = await getSystemPlaylist(user._id, SYSTEM.tasteMix.key);
  if (!playlist) return null;
  const recos = require('./recommendationService');
  const { items } = await recos.recommendForUser(user, { limit });
  const songs = await resolveSongs(items.map((i) => i.id));
  playlist.tracks = songs.map((s) => toTrack(s, { source: 'recommendation' }));
  playlist.recalculate();
  await playlist.save();
  return playlist;
}

async function publicPlaylists({ limit = 30, page = 1, owner } = {}) {
  const filter = { visibility: 'public', deletedAt: null };
  if (owner) filter.owner = owner;
  const [items, total] = await Promise.all([
    Playlist.find(filter).sort({ followerCount: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Playlist.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

module.exports = {
  SYSTEM,
  create,
  list,
  get,
  update,
  remove,
  addTracks,
  removeTracks,
  reorder,
  toggleLike,
  isLiked,
  ensureSystemPlaylists,
  getSystemPlaylist,
  refreshOnRepeat,
  refreshTasteMix,
  publicPlaylists,
  resolveSongs,
  toTrack,
  nextPlaylistName,
  slugify,
};
