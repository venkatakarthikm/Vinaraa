'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok, paginated } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const statsService = require('../services/statsService');
const catalog = require('../services/catalog');
const PlayEvent = require('../models/PlayEvent');
const ListeningSession = require('../models/ListeningSession');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/** Everything the Stats screen needs in ONE request: overview, top lists,
 *  timeline, heatmap, quality breakdown and recently played. */
router.get(
  '/dashboard',
  validate(s.rangeSchema),
  asyncHandler(async (req, res) => ok(res, await statsService.dashboard(req.user, { range: req.query.range })))
);

router.get(
  '/overview',
  validate(s.rangeSchema),
  asyncHandler(async (req, res) => ok(res, await statsService.overview(req.user, { range: req.query.range })))
);

router.get(
  '/top',
  validate(s.topSchema),
  asyncHandler(async (req, res) => ok(res, await statsService.top({ user: req.user, type: req.query.type, range: req.query.range, limit: req.query.limit })))
);

router.get(
  '/timeline',
  validate(s.rangeSchema),
  asyncHandler(async (req, res) => ok(res, await statsService.timeline(req.user, { range: req.query.range })))
);

router.get(
  '/heatmap',
  validate(s.rangeSchema),
  asyncHandler(async (req, res) => ok(res, await statsService.heatmap(req.user, { range: req.query.range === '30d' ? '90d' : req.query.range })))
);

router.get(
  '/quality',
  validate(s.rangeSchema),
  asyncHandler(async (req, res) => ok(res, await statsService.listeningQuality(req.user, { range: req.query.range })))
);

/** Written insights ("You listened 42h 10m…"), ready to render as cards. */
router.get(
  '/insights',
  asyncHandler(async (req, res) => ok(res, await statsService.insights(req.user)))
);

router.get(
  '/recently-played',
  asyncHandler(async (req, res) => ok(res, await statsService.recentlyPlayed(req.user, { limit: Number(req.query.limit) || 30 })))
);

/** Raw play history, newest first (paginated). */
router.get(
  '/history',
  validate(s.paginationSchema),
  asyncHandler(async (req, res) => {
    const page = req.query.page + 1;
    const limit = req.query.limit;
    const filter = { user: req.user._id };
    if (req.query.eventType) filter.eventType = req.query.eventType;
    const [items, total] = await Promise.all([
      PlayEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      PlayEvent.countDocuments(filter),
    ]);
    return paginated(
      res,
      items.map((e) => ({
        id: e._id,
        eventType: e.eventType,
        songId: e.songId,
        songName: e.songName,
        image: e.songImage,
        albumName: e.albumName,
        listenedMs: e.listenedMs,
        positionMs: e.positionMs,
        completed: e.completed,
        skipped: e.skipped,
        seekCount: e.seekCount,
        at: e.createdAt,
      })),
      { page, limit, total }
    );
  })
);

/** Session-level history — shows the seek-proof listenedMs per track. */
router.get(
  '/history/sessions',
  validate(s.paginationSchema),
  asyncHandler(async (req, res) => {
    const page = req.query.page + 1;
    const limit = req.query.limit;
    const [items, total] = await Promise.all([
      ListeningSession.find({ user: req.user._id }).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ListeningSession.countDocuments({ user: req.user._id }),
    ]);
    return paginated(
      res,
      items.map((x) => ({
        sessionId: x._id,
        songId: x.songId,
        songName: x.songName,
        image: x.songImage,
        durationMs: x.durationMs,
        listenedMs: x.listenedMs,
        wallClockMs: x.wallClockMs,
        completionRatio: x.completionRatio,
        isCompleted: x.isCompleted,
        isSkip: x.isSkip,
        seekCount: x.seekCount,
        source: x.source,
        startedAt: x.startedAt,
        endedAt: x.endedAt,
      })),
      { page, limit, total }
    );
  })
);

/**
 * Verification endpoint: proves the skip-proof tracking maths for one session.
 * Send a synthetic timeline and see exactly what the server would credit.
 */
router.post(
  '/verify-tracking',
  asyncHandler(async (req, res) => {
    const { durationMs = 240000, steps = [] } = req.body || {};
    if (!Array.isArray(steps) || !steps.length) {
      return ok(res, {
        explanation: 'POST { durationMs, steps:[{positionMs,state,afterMs}] } — afterMs is the wall-clock gap since the previous step.',
        example: { durationMs: 240000, steps: [{ positionMs: 15000, state: 'playing', afterMs: 15000 }, { positionMs: 240000, state: 'playing', afterMs: 1000 }] },
      });
    }
    const fake = { durationMs, listenedMs: 0, lastPositionMs: 0, lastHeartbeatAt: new Date(Date.now() - steps[0].afterMs) };
    const trace = [];
    let credited = 0;
    for (const step of steps) {
      fake.lastHeartbeatAt = new Date(Date.now() - (step.afterMs || 0));
      const result = require('../services/trackingService').computeCredit(fake, { positionMs: step.positionMs, state: step.state || 'playing', now: Date.now() });
      credited += result.credit;
      fake.listenedMs += result.credit;
      fake.lastPositionMs = step.positionMs;
      trace.push({ ...step, creditedMs: result.credit, seekDetected: result.seek, reason: result.reason });
    }
    return ok(res, {
      durationMs,
      totalCreditedMs: credited,
      completionPercent: Math.round((credited / durationMs) * 100),
      trace,
    });
  })
);

module.exports = router;
