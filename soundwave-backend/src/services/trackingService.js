'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { dateKey, hourOfDay, weekday } = require('../utils/time');
const ListeningSession = require('../models/ListeningSession');
const PlayEvent = require('../models/PlayEvent');
const DailyStat = require('../models/DailyStat');
const Song = require('../models/Song');
const Entity = require('../models/Entity');
const User = require('../models/User');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFECT LISTENING-TIME TRACKING
 * ─────────────────────────────────────────────────────────────────────────────
 * The server decides what was really heard. The client only reports position.
 *
 * For each heartbeat the server computes:
 *     elapsed = now − lastHeartbeatAt          (wall clock)
 *     advance = positionMs − lastPositionMs    (playhead movement)
 *
 *   state ≠ playing .......... credit 0            (paused / buffering)
 *   advance ≤ 0 .............. credit 0            (rewind, repeat, stall)
 *   advance ≤ elapsed + tol .. credit advance      (honest playback)
 *   advance > elapsed + tol .. credit 0 + SEEK     (jumped to middle/end)
 *
 * So "skip to the end" credits ~0 s of listening time, while genuinely playing
 * through a track credits real seconds — even if the client reports only twice.
 * Tolerance covers timer jitter, network latency and 1x-speed rounding.
 */
const SEEK_TOLERANCE_MS = 2500;
const MAX_CREDIT_PER_HEARTBEAT_MS = 5 * 60000; // a client asleep for 10 min must not credit 10 min
const HEARTBEAT_STALE_MS = 10 * 60000;

const ACTIVE_STATES = new Set(['playing']);

function computeCredit(session, { positionMs, state, now }) {
  const elapsed = Math.max(0, now - new Date(session.lastHeartbeatAt || session.startedAt).getTime());
  const previous = session.lastPositionMs || 0;
  const advance = positionMs - previous;

  const result = { credit: 0, seek: false, seekDistance: 0, elapsed, advance, reason: 'ok' };

  if (!ACTIVE_STATES.has(state)) {
    result.reason = state === 'buffering' ? 'buffering' : 'not_playing';
    return result;
  }
  if (elapsed > HEARTBEAT_STALE_MS) {
    result.reason = 'stale_heartbeat';
    return result;
  }
  if (advance <= 0) {
    result.reason = advance < 0 ? 'rewind' : 'no_advance';
    return result;
  }
  const allowed = Math.min(elapsed + SEEK_TOLERANCE_MS, MAX_CREDIT_PER_HEARTBEAT_MS);
  if (advance <= allowed) {
    result.credit = Math.min(advance, MAX_CREDIT_PER_HEARTBEAT_MS);
    return result;
  }
  // The playhead moved further than time allows → the user seeked.
  result.seek = true;
  result.seekDistance = advance;
  result.reason = 'seek_detected';
  return result;
}

/** Opens a listening session for a song. */
async function startSession(user, payload) {
  const { songId, deviceId, source = 'unknown', contextId, positionMs = 0, song } = payload;
  const snapshot = song || (await Song.findOne({ saavnId: songId }).lean());
  if (!snapshot) throw AppError.notFound('Song not found in catalogue', 'SONG_NOT_FOUND');

  const now = new Date();
  const session = await ListeningSession.create({
    user: user._id,
    deviceId,
    songId: String(songId),
    songName: snapshot.name,
    songImage: snapshot.images?.length ? snapshot.images[snapshot.images.length - 1]?.url : undefined,
    artistsText: (snapshot.singers || []).map((s) => s.name).join(', '),
    albumId: snapshot.album?.id,
    albumName: snapshot.album?.name,
    language: snapshot.language,
    durationMs: snapshot.durationMs || 0,
    singerIds: (snapshot.singers || []).map((s) => String(s.id)),
    directorIds: (snapshot.musicDirectors || []).map((s) => String(s.id)),
    actorIds: (snapshot.actors || []).map((s) => String(s.id)),
    lastPositionMs: positionMs,
    maxPositionMs: positionMs,
    state: 'playing',
    source,
    contextId,
    startedAt: now,
    lastHeartbeatAt: now,
    dayKey: dateKey(now),
    hourOfDay: hourOfDay(now),
    weekday: weekday(now),
  });

  await Promise.all([
    PlayEvent.create(eventFromSession(session, { eventType: 'play_start', positionMs, listenedMs: 0 })),
    User.updateOne({ _id: user._id }, { $inc: { 'stats.totalSessions': 1 }, $set: { 'stats.lastActiveAt': now } }),
    DailyStat.updateOne(
      { user: user._id, dayKey: session.dayKey },
      { $inc: { sessions: 1, ...(session.language ? { [`languages.${session.language}`]: 0 } : {}) }, $setOnInsert: { user: user._id, dayKey: session.dayKey } },
      { upsert: true }
    ),
  ]).catch((err) => logger.warn('session bootstrap side-effects failed', { err: err.message }));

  return session;
}

function eventFromSession(session, { eventType, positionMs, listenedMs, skipped = false, completed = false, seekCount = 0 }) {
  return {
    user: session.user,
    sessionId: session._id,
    deviceId: session.deviceId,
    songId: session.songId,
    songName: session.songName,
    songImage: session.songImage,
    albumId: session.albumId,
    albumName: session.albumName,
    language: session.language,
    durationMs: session.durationMs,
    singerIds: session.singerIds,
    directorIds: session.directorIds,
    actorIds: session.actorIds,
    eventType,
    positionMs,
    listenedMs,
    completed,
    skipped,
    seekCount,
    source: session.source,
    contextId: session.contextId,
    dayKey: session.dayKey,
    hourOfDay: session.hourOfDay,
    weekday: session.weekday,
  };
}

/**
 * Heartbeat: the ONLY place listened time is credited.
 * Idempotent per heartbeat and safe against duplicate delivery (advance ≤ 0
 * after a duplicate credits 0).
 */
async function heartbeat(user, sessionId, { positionMs, state = 'playing', clientTimestamp, bufferedMs }) {
  const session = await ListeningSession.findOne({ _id: sessionId, user: user._id });
  if (!session) throw AppError.notFound('Listening session not found', 'SESSION_NOT_FOUND');
  if (session.endedAt) throw AppError.badRequest('Session already ended', 'SESSION_ENDED');

  const now = Date.now();
  const { credit, seek, seekDistance, elapsed, reason, advance } = computeCredit(session, { positionMs, state, now });

  session.listenedMs += credit;
  session.wallClockMs += elapsed;
  session.lastPositionMs = positionMs;
  session.maxPositionMs = Math.max(session.maxPositionMs || 0, positionMs);
  session.lastHeartbeatAt = new Date(now);
  session.state = state;
  if (credit > 0) session.segments.push({ fromMs: session.lastPositionMs - credit, toMs: positionMs, startWall: new Date(now - credit), endWall: new Date(now) });
  if (seek) {
    session.seekCount += 1;
    session.seekDistanceMs += seekDistance;
  }
  session.recompute();
  if (session.segments.length > 500) session.segments = session.segments.slice(-200); // bound the document

  // A client-observed completion is trusted only when our measured time agrees.
  if (state === 'ended' || (session.durationMs && positionMs >= session.durationMs - 2000)) {
    session.isCompleted = session.durationMs > 0 ? session.listenedMs >= session.durationMs * env.RECO_PLAY_RATIO : session.listenedMs >= env.RECO_MIN_LISTEN_MS;
    session.state = 'ended';
  }

  await session.save();

  return {
    sessionId: session._id,
    creditedMs: credit,
    listenedMs: session.listenedMs,
    wallClockMs: session.wallClockMs,
    completionRatio: session.completionRatio,
    isCompleted: session.isCompleted,
    isCountedPlay: session.isCountedPlay,
    seekDetected: seek,
    reason,
    advance,
    elapsed,
    bufferedMs,
    clientTimestamp,
    serverTime: new Date(now),
  };
}

/** Records a discrete event (like, queue add, pause, seek) on the session. */
async function recordEvent(user, sessionId, { eventType, positionMs = 0, songId, meta }) {
  let session = null;
  if (sessionId) session = await ListeningSession.findOne({ _id: sessionId, user: user._id });
  if (!session && songId) session = { user: user._id, songId, durationMs: 0, dayKey: dateKey(), hourOfDay: hourOfDay(), weekday: weekday() };
  if (!session) throw AppError.badRequest('sessionId or songId is required', 'MISSING_TARGET');

  const event = await PlayEvent.create({ ...eventFromSession(session, { eventType, positionMs, listenedMs: 0 }), meta });
  if (eventType === 'like') {
    await Promise.all([
      Song.updateOne({ saavnId: session.songId }, { $inc: { 'metrics.ourLikes': 1, 'metrics.trendingScore': 8 } }),
      User.updateOne({ _id: user._id }, { $inc: { 'stats.likedSongs': 1 } }),
      DailyStat.updateOne({ user: user._id, dayKey: dateKey() }, { $inc: { likes: 1 }, $setOnInsert: { user: user._id, dayKey: dateKey() } }, { upsert: true }),
    ]).catch(() => {});
  }
  if (eventType === 'skip' && session.songId) {
    await Song.updateOne({ saavnId: session.songId }, { $inc: { 'metrics.ourSkips': 1, 'metrics.trendingScore': -2 } }).catch(() => {});
  }
  return event;
}

/**
 * Closes a session and propagates the measured time into every rollup:
 * user lifetime counters, song/entity metrics, the daily rollup and a final
 * terminal event. This is the only writer of listened time.
 */
async function endSession(user, sessionId, { positionMs, reason = 'user_stop' } = {}) {
  const session = await ListeningSession.findOne({ _id: sessionId, user: user._id });
  if (!session) throw AppError.notFound('Listening session not found', 'SESSION_NOT_FOUND');
  if (session.endedAt) return { session, alreadyEnded: true };

  const now = Date.now();
  if (positionMs !== undefined && positionMs !== null) {
    const { credit, seek, seekDistance, elapsed } = computeCredit(session, { positionMs, state: 'ended', now });
    session.listenedMs += credit;
    session.wallClockMs += elapsed;
    session.maxPositionMs = Math.max(session.maxPositionMs || 0, positionMs);
    session.lastPositionMs = positionMs;
    if (seek) {
      session.seekCount += 1;
      session.seekDistanceMs += seekDistance;
    }
  }

  session.endedAt = new Date(now);
  session.state = session.isCompleted ? 'ended' : 'abandoned';
  session.recompute();
  await session.save();

  const listenedMs = session.listenedMs;
  const terminalType = session.isCompleted ? 'play_complete' : session.isCountedPlay ? 'pause' : 'skip';

  const day = session.dayKey || dateKey(session.startedAt);
  const hour = String(session.hourOfDay ?? hourOfDay(session.startedAt));

  await Promise.all([
    PlayEvent.create(
      eventFromSession(session, {
        eventType: terminalType,
        positionMs: session.lastPositionMs,
        listenedMs,
        skipped: !session.isCompleted,
        completed: session.isCompleted,
        seekCount: session.seekCount,
      })
    ),
    User.updateOne(
      { _id: user._id },
      {
        $inc: {
          'stats.totalListenedMs': listenedMs,
          'stats.totalPlays': session.isCountedPlay ? 1 : 0,
          'stats.totalSkips': !session.isCompleted && session.isSkip ? 1 : 0,
          'stats.completedPlays': session.isCompleted ? 1 : 0,
        },
        $set: { 'stats.lastActiveAt': new Date(now) },
      }
    ),
    Song.updateOne(
      { saavnId: session.songId },
      {
        $inc: {
          'metrics.ourPlays': session.isCountedPlay ? 1 : 0,
          'metrics.ourListenedMs': listenedMs,
          'metrics.ourCompletions': session.isCompleted ? 1 : 0,
          'metrics.ourSkips': !session.isCompleted && session.isSkip ? 1 : 0,
          'metrics.trendingScore': (session.isCountedPlay ? 5 : 0) + Math.round(listenedMs / 60000) + (session.isCompleted ? 3 : 0),
        },
        $set: { 'metrics.lastPlayedAt': new Date(now) },
      }
    ),
    DailyStat.updateOne(
      { user: user._id, dayKey: day },
      {
        $inc: {
          listenedMs,
          plays: session.isCountedPlay ? 1 : 0,
          skips: !session.isCompleted && session.isSkip ? 1 : 0,
          completions: session.isCompleted ? 1 : 0,
          seekCount: session.seekCount || 0,
          [`hours.${hour}`]: 1,
          ...(session.language ? { [`languages.${session.language}`]: listenedMs } : {}),
        },
        $setOnInsert: { user: user._id, dayKey: day },
      },
      { upsert: true }
    ),
  ]).catch((err) => logger.warn('session finalisation side-effects failed', { err: err.message, sessionId: String(sessionId) }));

  // Entity popularity for the taste engine.
  const entityOps = [];
  const pushInc = (type, id, extra = 0) => {
    if (!id) return;
    entityOps.push({
      updateOne: {
        filter: { type, entityId: String(id) },
        update: { $inc: { 'metrics.ourListenedMs': listenedMs, 'metrics.ourPlays': session.isCountedPlay ? 1 : 0, 'metrics.popularity': extra } },
        upsert: false,
      },
    });
  };
  (session.singerIds || []).forEach((id) => pushInc('artist', id, 2));
  (session.directorIds || []).forEach((id) => pushInc('musicDirector', id, 2));
  (session.actorIds || []).forEach((id) => pushInc('actor', id, 2));
  pushInc('album', session.albumId, 3);
  if (entityOps.length) await Entity.bulkWrite(entityOps, { ordered: false }).catch(() => {});

  await updateStreak(user._id, day);

  return { session, terminalEvent: terminalType, listenedMs };
}

/** Recomputes the daily listening streak after each session close. */
async function updateStreak(userId, day) {
  try {
    const user = await User.findById(userId).select('stats');
    if (!user) return;
    const last = user.stats.lastListenedDateKey;
    if (last === day) return;
    const yesterday = dateKey(new Date(new Date(`${day}T00:00:00Z`).getTime() - 86400000));
    const streak = last === yesterday ? (user.stats.streakDays || 0) + 1 : 1;
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          'stats.streakDays': streak,
          'stats.longestStreakDays': Math.max(streak, user.stats.longestStreakDays || 0),
          'stats.lastListenedDateKey': day,
          ...(user.stats.firstListenedAt ? {} : { 'stats.firstListenedAt': new Date() }),
        },
      }
    );
  } catch (err) {
    logger.debug('streak update failed', { err: err.message });
  }
}

/** Closes sessions abandoned by a killed app (client never sent /end). */
async function reapStaleSessions(maxAgeMinutes = 30) {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60000);
  const stale = await ListeningSession.find({ endedAt: null, lastHeartbeatAt: { $lt: cutoff } }).limit(200).select('_id user').lean();
  let closed = 0;
  for (const s of stale) {
    try {
      const user = await User.findById(s.user);
      if (user) await endSession(user, s._id, { reason: 'reaped_stale' });
      closed += 1;
    } catch (err) {
      logger.debug('stale session reap failed', { err: err.message });
    }
  }
  return { closed, candidates: stale.length };
}

/** Resume/recent state for the player UI. */
async function getSession(user, sessionId) {
  const session = await ListeningSession.findOne({ _id: sessionId, user: user._id }).lean();
  if (!session) throw AppError.notFound('Listening session not found', 'SESSION_NOT_FOUND');
  return session;
}

async function activeSessions(user) {
  return ListeningSession.find({ user: user._id, endedAt: null }).sort({ startedAt: -1 }).limit(5).lean();
}

module.exports = {
  startSession,
  heartbeat,
  endSession,
  recordEvent,
  getSession,
  activeSessions,
  reapStaleSessions,
  computeCredit,
  updateStreak,
  SEEK_TOLERANCE_MS,
};
