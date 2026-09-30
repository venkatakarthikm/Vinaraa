'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AppError } = require('../utils/errors');
const authService = require('../services/authService');
const playlistService = require('../services/playlistService');
const tasteService = require('../services/tasteService');
const recommendationService = require('../services/recommendationService');
const SearchHistory = require('../models/SearchHistory');
const User = require('../models/User');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/** Full profile + derived taste summary in one call (app startup). */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const [profile, depth, playlists] = await Promise.all([
      tasteService.buildTasteProfile(req.user),
      tasteService.historyDepth(req.user._id),
      playlistService.list(req.user._id, { limit: 1 }),
    ]);
    return ok(res, {
      user: authService.publicUser(req.user),
      taste: tasteService.toClientProfile(profile),
      historyDepth: depth,
      playlistCount: playlists.total,
    });
  })
);

router.patch(
  '/me',
  validate(s.updateMeSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    for (const [k, v] of Object.entries(req.body)) {
      if (k === 'handle') user.handle = String(v).toLowerCase().replace(/[^a-z0-9_]/g, '');
      else if (k === 'dateOfBirth') user.dateOfBirth = new Date(v);
      else user[k] = v;
    }
    await user.save();
    return ok(res, authService.publicUser(user));
  })
);

/** Playback + taste preferences (languages, audio quality, data saver…). */
router.patch(
  '/me/preferences',
  validate(s.preferencesSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    for (const [k, v] of Object.entries(req.body)) {
      if (['singers', 'musicDirectors', 'actors', 'favouriteMovies'].includes(k)) {
        // Merge by id so re-saving never duplicates an entity.
        const existing = new Map((user.preferences?.[k] || []).map((e) => [e.id, e]));
        for (const item of v) existing.set(item.id, item);
        user.preferences[k] = [...existing.values()].slice(0, 60);
      } else {
        user.preferences[k] = v;
      }
    }
    await user.save();
    return ok(res, { preferences: user.preferences });
  })
);

/** Replaces the whole taste seed set in one shot (onboarding "edit" screen). */
router.put(
  '/me/taste-seeds',
  validate(s.onboardingCompleteSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    user.preferences.languages = req.body.languages;
    user.preferences.singers = req.body.singers;
    user.preferences.musicDirectors = req.body.musicDirectors;
    user.preferences.actors = req.body.actors;
    user.preferences.favouriteMovies = req.body.favouriteMovies;
    await user.save();
    const profile = await tasteService.buildTasteProfile(user);
    return ok(res, { preferences: user.preferences, taste: tasteService.toClientProfile(profile) });
  })
);

/* ── devices (push tokens, live-activity opt-in) ─────────────── */
router.post(
  '/me/devices',
  validate(s.deviceRegisterSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const device = user.touchDevice(req.body);
    await user.save();
    return ok(res, { deviceId: device.deviceId, registered: true });
  })
);

router.delete(
  '/me/devices/:deviceId',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $pull: { devices: { deviceId: req.params.deviceId } } });
    return ok(res, { removed: req.params.deviceId });
  })
);

/* ── search history ─────────────────────────────────────────── */
router.get(
  '/me/search-history',
  validate(s.rangeSchema),
  asyncHandler(async (req, res) => {
    const items = await SearchHistory.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(Math.min(req.query.limit || 20, 100))
      .lean();
    return ok(res, items.map((i) => ({ query: i.query, scope: i.scope, resultCount: i.resultCount, at: i.createdAt })));
  })
);

router.post(
  '/me/search-history',
  validate(s.searchHistorySchema),
  asyncHandler(async (req, res) => {
    const normalized = req.body.query.trim().toLowerCase();
    // One row per distinct query — repeat searches just bubble it to the top.
    await SearchHistory.findOneAndUpdate(
      { user: req.user._id, normalizedQuery: normalized },
      { $set: { ...req.body, normalizedQuery: normalized, createdAt: new Date() } },
      { upsert: true, new: true }
    );
    return ok(res, { recorded: true });
  })
);

router.delete(
  '/me/search-history',
  asyncHandler(async (req, res) => {
    const { deletedCount } = await SearchHistory.deleteMany({ user: req.user._id });
    return ok(res, { deleted: deletedCount || 0 });
  })
);

router.delete(
  '/me/search-history/:query',
  asyncHandler(async (req, res) => {
    await SearchHistory.deleteOne({ user: req.user._id, normalizedQuery: req.params.query.toLowerCase() });
    return ok(res, { deleted: req.params.query });
  })
);

/* ── export + delete ─────────────────────────────────────────── */
router.get(
  '/me/export',
  asyncHandler(async (req, res) => {
    const [user, playlists] = await Promise.all([
      User.findById(req.user._id).lean(),
      playlistService.list(req.user._id, { limit: 500 }),
    ]);
    const PlayEvent = require('../models/PlayEvent');
    const guard = async (p) => p.catch(() => []);
    const [events, history] = await Promise.all([
      guard(PlayEvent.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(5000).lean()),
      guard(SearchHistory.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(1000).lean()),
    ]);
    delete user.passwordHash;
    delete user.security;
    return ok(res, {
      exportedAt: new Date(),
      user,
      playlists: playlists.items,
      playEvents: events,
      searchHistory: history,
    });
  })
);

/** Soft delete (GDPR-friendly): account is closed, sessions revoked, data unlinked. */
router.delete(
  '/me',
  asyncHandler(async (req, res) => {
    if (req.body?.confirm !== 'DELETE') throw AppError.badRequest('Send { "confirm": "DELETE" } to close the account', 'CONFIRM_REQUIRED');
    const tokenService = require('../services/tokenService');
    await tokenService.revokeAllForUser(req.user._id, 'account_deleted');
    await User.updateOne({ _id: req.user._id }, { $set: { status: 'deleted', email: `deleted+${req.user._id}@soundwave.invalid` } });
    return ok(res, { deleted: true });
  })
);

module.exports = router;
