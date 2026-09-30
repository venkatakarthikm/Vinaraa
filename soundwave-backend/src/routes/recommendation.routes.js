'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const recommendationService = require('../services/recommendationService');
const tasteService = require('../services/tasteService');
const catalog = require('../services/catalog');
const Song = require('../models/Song');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/** Home feed: several explained rails from one request. */
router.get(
  '/feed',
  asyncHandler(async (req, res) => ok(res, await recommendationService.buildFeed(req.user, { limit: Number(req.query.limit) || 20 })))
);

/**
 * Ranked recommendations. Every item carries matchPercent + a per-dimension
 * breakdown (movie / hero / language / singer / director), which is exactly the
 * "% match" UI the user asked for.
 */
router.get(
  '/for-you',
  validate(s.recommendSchema),
  asyncHandler(async (req, res) => {
    const result = await recommendationService.recommendForUser(req.user, {
      limit: req.query.limit,
      offset: req.query.offset,
      language: req.query.language,
      strictRepeat: req.query.strictRepeat,
    });
    return ok(res, result.items, {
      poolSize: result.poolSize,
      offset: req.query.offset,
      limit: req.query.limit,
      profile: result.profile,
      strategy: 'movie → hero → language → singer → music director',
      weights: require('../config/env').recoWeights,
    });
  })
);

/** Autoplay / "next up" — same movie first, then hero/singer/director cluster. */
router.get(
  '/next',
  validate(s.nextSchema),
  asyncHandler(async (req, res) => {
    const excludeIds = String(req.query.excludeIds || '').split(',').filter(Boolean).slice(0, 100);
    const result = await recommendationService.nextSong(req.user, {
      currentSongId: req.query.currentSongId,
      excludeIds,
      limit: req.query.limit,
    });
    return ok(res, { source: result.source, items: result.items, profile: result.profile });
  })
);

/** Radio from a song, entity or playlists — infinite, explained. */
router.get(
  '/radio',
  asyncHandler(async (req, res) => {
    const { songId, entityId, entityType, language, limit } = req.query;
    const want = Math.min(Number(limit) || 30, 50);
    const profile = await tasteService.buildTasteProfile(req.user);

    let items = [];
    let seed = {};

    if (songId) {
      const song = await Song.findOne({ saavnId: songId }).lean();
      if (song) {
        seed = { type: 'song', songId, name: song.name, albumId: song.album?.id, singers: (song.singers || []).map((x) => x.id) };
        const or = [];
        if (song.album?.id) or.push({ 'album.id': song.album.id });
        if (song.singers?.length) or.push({ 'singers.id': { $in: song.singers.map((x) => x.id) } });
        if (song.musicDirectors?.length) or.push({ 'musicDirectors.id': { $in: song.musicDirectors.map((x) => x.id) } });
        if (song.actors?.length) or.push({ 'actors.id': { $in: song.actors.map((x) => x.id) } });
        if (song.language) or.push({ language: song.language });
        const pool = await Song.find({ $or: or, saavnId: { $ne: songId } }).limit(want * 4).lean();
        items = pool
          .map((x) => ({ song: x, ...recommendationService.scoreSong(x, profile, {}) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, want)
          .map((r) => ({ ...catalog.toClientSong(r.song), matchPercent: r.explain.total, explain: r.explain, reason: recommendationService.buildReason(r.explain) }));
      }
    } else if (entityId) {
      const type = ['artist', 'musicDirector', 'actor', 'album', 'language'].includes(entityType) ? entityType : 'artist';
      const field = { artist: 'singers.id', musicDirector: 'musicDirectors.id', actor: 'actors.id', album: 'album.id', language: 'language' }[type];
      seed = { type, entityId };
      const pool = await Song.find({ [field]: type === 'language' ? entityId : entityId }).sort({ 'metrics.trendingScore': -1, playCount: -1 }).limit(want * 3).lean();
      items = pool.map((x) => ({ ...catalog.toClientSong(x), matchPercent: recommendationService.scoreSong(x, profile, {}).explain.total }));
    }

    if (!items.length) {
      const fallback = await recommendationService.recommendForUser(req.user, { limit: want, language, profile });
      items = fallback.items;
      seed = seed.name ? seed : { type: 'personal', language };
    }

    return ok(res, { seed, items, count: items.length });
  })
);

/** Per-entity rails: movie → hero → language → singer → director. */
router.get(
  '/entity/:type/:id',
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const id = req.params.id;
    const field = { artist: 'singers.id', singer: 'singers.id', musicDirector: 'musicDirectors.id', director: 'musicDirectors.id', actor: 'actors.id', hero: 'actors.id', album: 'album.id', movie: 'album.id' }[type];
    if (!field) return ok(res, { type, id, items: [], note: 'Unsupported entity type' });

    const profile = await tasteService.buildTasteProfile(req.user);
    const canonical = ['actor', 'hero'].includes(type) ? 'actor' : ['musicDirector', 'director'].includes(type) ? 'musicDirector' : ['album', 'movie'].includes(type) ? 'album' : 'artist';
    const entity = await require('../models/Entity').findOne({ type: canonical, entityId: id }).lean();

    const songs = await Song.find({ [field]: id }).sort({ 'metrics.trendingScore': -1, playCount: -1 }).limit(50).lean();
    const tasteBucket = canonical === 'actor' ? profile.actors : canonical === 'musicDirector' ? profile.directors : canonical === 'album' ? profile.movies : profile.singers;

    return ok(res, {
      type: canonical,
      id,
      name: entity?.name,
      image: entity?.image,
      subtitle: entity?.subtitle,
      yourAffinityPercent: Math.round((tasteBucket[id]?.weight || 0) * 100),
      inYourTaste: Boolean(tasteBucket[id]),
      items: songs.map((x) => ({ ...catalog.toClientSong(x), matchPercent: recommendationService.scoreSong(x, profile, {}).explain.total })),
    });
  })
);

/** The user's taste profile, explained. */
router.get(
  '/taste-profile',
  asyncHandler(async (req, res) => {
    const profile = await tasteService.buildTasteProfile(req.user);
    return ok(res, {
      ...tasteService.toClientProfile(profile),
      strategy: 'movie → hero → language → singer → music director',
      priority: ['movie', 'hero', 'language', 'singer', 'director'],
      historyDepth: await tasteService.historyDepth(req.user._id),
      sourceNote: 'Built from your measured listening time (skips count as ~0 s) blended with your onboarding picks.',
    });
  })
);

/** Bumps onboarding step so the wizard can resume where it stopped. */
router.post(
  '/taste-profile/step',
  asyncHandler(async (req, res) => {
    const step = Number(req.body?.step) || 0;
    await require('../models/User').updateOne({ _id: req.user._id }, { $set: { 'onboarding.lastStep': step } });
    return ok(res, { lastStep: step });
  })
);

module.exports = router;
