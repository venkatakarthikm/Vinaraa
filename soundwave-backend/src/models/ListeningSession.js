'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PERFECT LISTENING-TIME TRACKING
 * ─────────────────────────────────────────────────────────────────────────────
 * The server — not the client — decides how much was really heard.
 *
 * The client only reports its playback position. For every report the server
 * computes:  advance = positionMs - lastPositionMs
 * and credits time ONLY when the advance is physically consistent with the
 * wall-clock time that passed (advance <= elapsed + tolerance). A jump to the
 * middle/end of a track is a SEEK: it updates lastPositionMs but credits ZERO.
 * Pausing credits nothing. Replaying the same range credits only real elapsed
 * playback. That is what makes skip-to-end count as ~0 listened time.
 */
const segmentSchema = new mongoose.Schema(
  { fromMs: Number, toMs: Number, startWall: Date, endWall: Date },
  { _id: false }
);

const listeningSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: String,

    songId: { type: String, required: true, index: true },
    songName: String,
    songImage: String,
    artistsText: String,
    albumId: String,
    albumName: String,
    language: String,
    durationMs: { type: Number, default: 0 },
    singerIds: [String],
    directorIds: [String],
    actorIds: [String],

    // ── Measured playback ──
    listenedMs: { type: Number, default: 0 }, // credited, seek-proof
    wallClockMs: { type: Number, default: 0 }, // time the session stayed open
    maxPositionMs: { type: Number, default: 0 },
    lastPositionMs: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
    seekCount: { type: Number, default: 0 },
    seekDistanceMs: { type: Number, default: 0 },
    pauseCount: { type: Number, default: 0 },
    bufferCount: { type: Number, default: 0 },
    segments: { type: [segmentSchema], default: [] },

    completionRatio: { type: Number, default: 0 }, // listenedMs / durationMs
    isCompleted: { type: Boolean, default: false }, // >= RECO_PLAY_RATIO of the track
    isSkip: { type: Boolean, default: false }, // abandoned early
    isCountedPlay: { type: Boolean, default: false }, // >= RECO_MIN_LISTEN_MS → real play

    state: { type: String, enum: ['playing', 'paused', 'buffering', 'ended', 'abandoned'], default: 'playing', index: true },
    source: { type: String, enum: ['search', 'playlist', 'album', 'artist', 'recommendation', 'radio', 'library', 'offline', 'unknown'], default: 'unknown' },
    contextId: String,

    // No `index: true` here — the TTL index below already covers { startedAt: 1 }.
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    lastHeartbeatAt: Date,
    dayKey: String,
    hourOfDay: Number,
    weekday: Number,
  },
  { timestamps: true }
);

listeningSessionSchema.index({ user: 1, startedAt: -1 });
listeningSessionSchema.index({ user: 1, dayKey: 1 });
listeningSessionSchema.index({ user: 1, songId: 1, startedAt: -1 });
listeningSessionSchema.index({ songId: 1, isCountedPlay: 1 });
// Raw session detail is short-lived; the aggregated rollups keep the long history.
listeningSessionSchema.index({ startedAt: 1 }, { expireAfterSeconds: env.TTL_RAW_SESSION_DAYS * 86400 });

listeningSessionSchema.methods.recompute = function recompute() {
  const dur = this.durationMs || 0;
  this.completionRatio = dur > 0 ? Number((this.listenedMs / dur).toFixed(4)) : 0;
  this.isCompleted = dur > 0 && this.listenedMs >= dur * env.RECO_PLAY_RATIO;
  this.isCountedPlay = this.listenedMs >= env.RECO_MIN_LISTEN_MS;
  this.isSkip = !this.isCompleted && this.listenedMs > 0 && this.listenedMs < env.RECO_MIN_LISTEN_MS;
  return this;
};

module.exports = mongoose.model('ListeningSession', listeningSessionSchema);
