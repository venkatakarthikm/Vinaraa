'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok, created } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const tracking = require('../services/trackingService');
const catalog = require('../services/catalog');
const SearchHistory = require('../models/SearchHistory');
const ListeningSession = require('../models/ListeningSession');
const Song = require('../models/Song');
const User = require('../models/User');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/**
 * ── the tracking contract the Android app must follow ────────────────
 * 1. On playback start            → POST /sessions
 * 2. Every 10–15 s while playing  → POST /sessions/:id/heartbeat  {positionMs,state}
 *    (also on pause / resume / buffer / seek / track end — send `state` honestly)
 * 3. When the track ends or the
 *    user leaves the player        → POST /sessions/:id/end {positionMs}
 * 4. Optional discrete events      → POST /sessions/:id/events
 *
 * The server credits listened time itself (see trackingService). The client
 * never reports "time listened" — only the playhead position. That is what
 * makes a skip-to-the-end count as ~0 seconds.
 */

router.post(
  '/sessions',
  validate(s.startSessionSchema),
  asyncHandler(async (req, res) => {
    const song = await Song.findOne({ saavnId: req.body.songId }).lean();
    if (!song) {
      // First time we see this song: fetch + persist it, then open the session.
      const fetched = await catalog.getSong(req.body.songId).catch(() => null);
      if (!fetched) console.warn('[tracking] song not found, session opens with durationMs=0', req.body.songId);
    }
    const session = await tracking.startSession(req.user, req.body);
    return created(res, {
      sessionId: session._id,
      songId: session.songId,
      songName: session.songName,
      durationMs: session.durationMs,
      startedAt: session.startedAt,
      heartbeatIntervalMs: 15000,
      note: 'Send a heartbeat every 10–15 s with the current position and state.',
    });
  })
);

router.post(
  '/sessions/:id/heartbeat',
  validate(s.heartbeatSchema),
  asyncHandler(async (req, res) => ok(res, await tracking.heartbeat(req.user, req.params.id, req.body)))
);

router.post(
  '/sessions/:id/end',
  validate(s.endSessionSchema),
  asyncHandler(async (req, res) => {
    const result = await tracking.endSession(req.user, req.params.id, req.body);
    return ok(res, {
      sessionId: result.session?._id,
      listenedMs: result.listenedMs,
      isCompleted: result.session?.isCompleted,
      isCountedPlay: result.session?.isCountedPlay,
      completionRatio: result.session?.completionRatio,
      seekCount: result.session?.seekCount,
      terminalEvent: result.terminalEvent,
      alreadyEnded: Boolean(result.alreadyEnded),
    });
  })
);

router.post(
  '/sessions/:id/events',
  validate(s.sessionEventSchema),
  asyncHandler(async (req, res) => {
    const event = await tracking.recordEvent(req.user, req.params.id, req.body);
    return created(res, { id: event._id, eventType: event.eventType, at: event.createdAt });
  })
);

router.get(
  '/sessions/active',
  asyncHandler(async (req, res) => {
    const sessions = await tracking.activeSessions(req.user);
    const songs = await Song.find({ saavnId: { $in: sessions.map((x) => x.songId) } }).lean();
    const map = new Map(songs.map((x) => [x.saavnId, x]));
    return ok(res, sessions.map((x) => ({ ...x, song: map.get(x.songId) ? catalog.toClientSong(map.get(x.songId)) : undefined })));
  })
);

router.get(
  '/sessions/:id',
  asyncHandler(async (req, res) => ok(res, await tracking.getSession(req.user, req.params.id)))
);

/**
 * Offline-first sync. The Android client queues sessions recorded with no
 * network and flushes them here.
 *
 * Deliberate design choice: offline sessions cannot be independently verified
 * server-side, so their listenedMs is CLAMPED to the track duration and their
 * wall-clock span, and they are tagged source='offline'. Trusted (online)
 * tracking still drives recommendations; offline data is only used for stats.
 */
router.post(
  '/sync',
  validate(s.syncSchema),
  asyncHandler(async (req, res) => {
    const { sessions = [], searchHistory = [] } = req.body;
    const results = [];

    for (const item of sessions) {
      try {
        const song = await Song.findOne({ saavnId: item.songId }).lean();
        const durationMs = item.durationMs || song?.durationMs || 0;
        const startedAt = new Date(item.startedAt);
        const endedAt = item.endedAt ? new Date(item.endedAt) : new Date(startedAt.getTime() + item.listenedMs);
        const wallSpan = Math.max(1000, endedAt.getTime() - startedAt.getTime());
        const clamped = Math.max(0, Math.min(item.listenedMs, durationMs || item.listenedMs, wallSpan));

        const session = await ListeningSession.create({
          user: req.user._id,
          deviceId: item.deviceId,
          songId: item.songId,
          songName: song?.name,
          songImage: song?.images?.[song.images.length - 1]?.url,
          albumId: song?.album?.id,
          albumName: song?.album?.name,
          language: song?.language,
          durationMs,
          singerIds: (song?.singers || []).map((x) => String(x.id)),
          directorIds: (song?.musicDirectors || []).map((x) => String(x.id)),
          actorIds: (song?.actors || []).map((x) => String(x.id)),
          listenedMs: clamped,
          wallClockMs: wallSpan,
          maxPositionMs: clamped,
          lastPositionMs: clamped,
          playCount: item.playCount,
          seekCount: item.seekCount,
          isCompleted: durationMs > 0 && clamped >= durationMs * 0.5,
          isCountedPlay: clamped >= 30000,
          state: 'ended',
          source: 'offline',
          startedAt,
          endedAt,
          lastHeartbeatAt: endedAt,
          dayKey: startedAt.toISOString().slice(0, 10),
          hourOfDay: startedAt.getUTCHours(),
          weekday: startedAt.getUTCDay(),
        });

        await User.updateOne(
          { _id: req.user._id },
          { $inc: { 'stats.totalListenedMs': clamped, 'stats.totalPlays': session.isCountedPlay ? 1 : 0, 'stats.totalSessions': 1, 'stats.completedPlays': session.isCompleted ? 1 : 0 } }
        );
        await Song.updateOne(
          { saavnId: item.songId },
          { $inc: { 'metrics.ourListenedMs': clamped, 'metrics.ourPlays': session.isCountedPlay ? 1 : 0 } }
        ).catch(() => {});
        results.push({ localId: item.localId, sessionId: session._id, acceptedMs: clamped, rejectedMs: item.listenedMs - clamped });
      } catch (err) {
        results.push({ localId: item.localId, error: err.message });
      }
    }

    for (const h of searchHistory) {
      await SearchHistory.findOneAndUpdate(
        { user: req.user._id, normalizedQuery: h.query.trim().toLowerCase() },
        { $set: { query: h.query, createdAt: h.at ? new Date(h.at) : new Date() }, $setOnInsert: { user: req.user._id } },
        { upsert: true }
      ).catch(() => {});
    }

    await tracking.updateStreak(req.user._id, new Date().toISOString().slice(0, 10));
    return ok(res, { accepted: results.filter((r) => !r.error).length, failed: results.filter((r) => r.error).length, results });
  })
);

module.exports = router;
