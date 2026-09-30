'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok, created, paginated } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { writeLimiter } = require('../middleware/rateLimit');
const playlistService = require('../services/playlistService');
const User = require('../models/User');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/* ── system playlists (must precede /:id) ────────────────────── */
router.get(
  '/system',
  asyncHandler(async (req, res) => {
    await playlistService.ensureSystemPlaylists(req.user).catch(() => {});
    const items = await require('../models/Playlist')
      .find({ owner: req.user._id, isSystem: true, deletedAt: null })
      .lean();
    return ok(res, items.map((p) => ({ id: p._id, systemKey: p.systemKey, name: p.name, description: p.description, trackCount: p.trackCount, coverImageUrl: p.coverImageUrl })));
  })
);

router.post(
  '/system/on-repeat/refresh',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const playlist = await playlistService.refreshOnRepeat(req.user, { limit: Number(req.body?.limit) || 30 });
    return ok(res, { id: playlist?._id, name: playlist?.name, trackCount: playlist?.trackCount });
  })
);

router.post(
  '/system/taste-mix/refresh',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const playlist = await playlistService.refreshTasteMix(req.user, { limit: Number(req.body?.limit) || 40 });
    return ok(res, { id: playlist?._id, name: playlist?.name, trackCount: playlist?.trackCount });
  })
);

router.get(
  '/liked',
  asyncHandler(async (req, res) => {
    await playlistService.ensureSystemPlaylists(req.user).catch(() => {});
    const liked = await playlistService.getSystemPlaylist(req.user._id, playlistService.SYSTEM.liked.key);
    if (!liked || !liked.tracks.length) return ok(res, { tracks: [], trackCount: 0 });
    
    const Song = require('../models/Song');
    const catalog = require('../services/catalog');
    const songs = await Song.find({ saavnId: { $in: liked.tracks.map((t) => t.songId) } }).lean();
    const map = new Map(songs.map((s) => [s.saavnId, s]));
    
    const populatedTracks = liked.tracks.map((t) => {
      const s = map.get(t.songId);
      return s ? catalog.toClientSong(s) : t;
    });

    return ok(res, { ...liked.toJSON(), tracks: populatedTracks });
  })
);

/** Like / unlike. `liked` omitted = toggle. Mirrors into "Liked Songs". */
router.post(
  '/liked',
  writeLimiter,
  validate(s.likeSchema),
  asyncHandler(async (req, res) => ok(res, await playlistService.toggleLike(req.user, req.body.songId, { like: req.body.liked })))
);

router.get(
  '/liked/:songId',
  asyncHandler(async (req, res) => ok(res, { songId: req.params.songId, liked: await playlistService.isLiked(req.user, req.params.songId) }))
);

router.get(
  '/public',
  asyncHandler(async (req, res) => {
    const result = await playlistService.publicPlaylists({ limit: Number(req.query.limit) || 30, page: Number(req.query.page) || 1 });
    return ok(res, result.items, { total: result.total, page: result.page, limit: result.limit });
  })
);

/* ── user playlists ─────────────────────────────────────────── */
router.get(
  '/',
  asyncHandler(async (req, res) =>
    paginated(res, (await playlistService.list(req.user._id, {
      includeSystem: req.query.includeSystem !== 'false',
      limit: Number(req.query.limit) || 50,
      page: Number(req.query.page) || 1,
      sort: req.query.sort || '-updatedAt',
    })).items, {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
      total: (await playlistService.list(req.user._id, { limit: 1 })).total,
    })
  )
);

/**
 * Create playlist. No name → auto "Playlist 1/2/3…" (the requested save flow).
 * Wrapped in a 409-retry so two simultaneous saves cannot collide on the name.
 */
router.post(
  '/',
  writeLimiter,
  validate(s.createPlaylistSchema),
  asyncHandler(async (req, res) => {
    let playlist;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        playlist = await playlistService.create(req.user._id, req.body);
        break;
      } catch (err) {
        if (err.code === 'DUPLICATE_KEY' && attempt < 2) continue;
        throw err;
      }
    }
    return created(res, { id: playlist._id, name: playlist.name, trackCount: playlist.trackCount, totalDurationMs: playlist.totalDurationMs, visibility: playlist.visibility, isSystem: playlist.isSystem });
  })
);

/** Suggested next name for the "create playlist" sheet, so the app can prefill it. */
router.get(
  '/name-suggestion',
  asyncHandler(async (req, res) => ok(res, { suggestedName: await playlistService.nextPlaylistName(req.user._id) }))
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const playlist = await playlistService.get(req.user, req.params.id);
    const isOwner = String(playlist.owner) === String(req.user._id);
    
    if (!playlist.tracks || !playlist.tracks.length) {
      return ok(res, { ...playlist.toJSON(), isOwner, tracks: [] });
    }

    const Song = require('../models/Song');
    const catalog = require('../services/catalog');
    const songs = await Song.find({ saavnId: { $in: playlist.tracks.map((t) => t.songId) } }).lean();
    const map = new Map(songs.map((s) => [s.saavnId, s]));
    
    const populatedTracks = playlist.tracks.map((t) => {
      const s = map.get(t.songId);
      return s ? catalog.toClientSong(s) : t;
    });

    return ok(res, { ...playlist.toJSON(), isOwner, tracks: populatedTracks });
  })
);

router.patch(
  '/:id',
  writeLimiter,
  validate(s.updatePlaylistSchema),
  asyncHandler(async (req, res) => {
    const playlist = await playlistService.update(req.user, req.params.id, req.body);
    return ok(res, { id: playlist._id, name: playlist.name, description: playlist.description, visibility: playlist.visibility, updatedAt: playlist.updatedAt });
  })
);

router.delete(
  '/:id',
  writeLimiter,
  asyncHandler(async (req, res) => {
    await playlistService.remove(req.user, req.params.id);
    return ok(res, { deleted: req.params.id });
  })
);

router.post(
  '/:id/tracks',
  writeLimiter,
  validate(s.addTracksSchema),
  asyncHandler(async (req, res) => {
    const result = await playlistService.addTracks(req.user, req.params.id, req.body.songIds, { source: req.body.source, position: req.body.position });
    return ok(res, { id: result.playlist._id, added: result.added, duplicatesSkipped: result.skipped, trackCount: result.playlist.trackCount });
  })
);

router.delete(
  '/:id/tracks',
  writeLimiter,
  validate(s.removeTracksSchema),
  asyncHandler(async (req, res) => {
    const result = await playlistService.removeTracks(req.user, req.params.id, req.body.songIds);
    return ok(res, { id: result.playlist._id, removed: result.removed, trackCount: result.playlist.trackCount });
  })
);

router.patch(
  '/:id/reorder',
  writeLimiter,
  validate(s.reorderSchema),
  asyncHandler(async (req, res) => {
    const playlist = await playlistService.reorder(req.user, req.params.id, req.body);
    return ok(res, { id: playlist._id, trackCount: playlist.trackCount, order: playlist.tracks.map((t) => t.songId) });
  })
);

router.post(
  '/:id/play',
  asyncHandler(async (req, res) => {
    const playlist = await playlistService.get(req.user, req.params.id);
    playlist.playCount += 1;
    playlist.lastPlayedAt = new Date();
    await playlist.save();
    return ok(res, { id: playlist._id, tracks: playlist.tracks, playCount: playlist.playCount });
  })
);

router.post(
  '/:id/duplicate',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const source = await playlistService.get(req.user, req.params.id);
    const copy = await playlistService.create(req.user._id, {
      name: `${source.name} copy`,
      description: source.description,
      visibility: 'private',
      trackIds: source.tracks.map((t) => t.songId),
      coverImageUrl: source.coverImageUrl,
    });
    return created(res, { id: copy._id, name: copy.name, trackCount: copy.trackCount });
  })
);

/** Adds a track to a playlist chosen by the "Save to playlist" bottom sheet. */
router.post(
  '/save-song',
  writeLimiter,
  asyncHandler(async (req, res) => {
    const { songId, playlistId, newPlaylistName } = req.body || {};
    if (!songId) throw AppError.badRequest('songId is required');
    let targetId = playlistId;
    let createdNew = false;
    if (!targetId) {
      const playlist = await playlistService.create(req.user._id, { name: newPlaylistName });
      targetId = playlist._id;
      createdNew = true;
    }
    const result = await playlistService.addTracks(req.user, targetId, [songId], { source: 'manual' });
    return ok(res, { playlistId: result.playlist._id, playlistName: result.playlist.name, createdNew, added: result.added, alreadyPresent: result.added === 0 });
  })
);

const { AppError } = require('../utils/errors');

module.exports = router;
