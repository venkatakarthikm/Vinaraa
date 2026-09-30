'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');

/**
 * Immutable granular event log — the raw material for analytics, streaks and
 * the taste engine. Denormalises the entity ids of the song at write time so
 * aggregations never need a join.
 */
const playEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ListeningSession', index: true },
    deviceId: String,

    songId: { type: String, required: true, index: true },
    songName: String,
    songImage: String,
    albumId: String,
    albumName: String,
    language: String,
    durationMs: { type: Number, default: 0 },

    // Entity snapshot → powers movie/hero/singer/director recommendations
    singerIds: [String],
    singerNames: [String],
    directorIds: [String],
    directorNames: [String],
    actorIds: [String],
    actorNames: [String],

    eventType: {
      type: String,
      enum: ['play_start', 'play_complete', 'skip', 'pause', 'resume', 'seek', 'like', 'unlike', 'queue_add', 'playlist_add', 'repeat'],
      required: true,
      index: true,
    },

    positionMs: { type: Number, default: 0 },
    listenedMs: { type: Number, default: 0 }, // actually-heard time attributed to this event
    completionRatio: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },
    seekCount: { type: Number, default: 0 },

    source: { type: String, enum: ['search', 'playlist', 'album', 'artist', 'recommendation', 'radio', 'library', 'offline', 'unknown'], default: 'unknown' },
    contextId: String,
    queueIndex: Number,

    dayKey: { type: String, index: true }, // YYYY-MM-DD (UTC) for daily rollups
    hourOfDay: Number,
    weekday: Number,

    clientTimestamp: Date,
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

playEventSchema.index({ user: 1, createdAt: -1 });
playEventSchema.index({ user: 1, dayKey: 1 });
playEventSchema.index({ user: 1, songId: 1, createdAt: -1 });
playEventSchema.index({ songId: 1, createdAt: -1 });
// Retention: raw events roll off automatically (analytics stay in rollups).
playEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: env.TTL_PLAY_EVENTS_DAYS * 86400 });

module.exports = mongoose.model('PlayEvent', playEventSchema);
