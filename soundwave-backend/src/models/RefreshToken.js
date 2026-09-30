'use strict';

const mongoose = require('mongoose');

/**
 * Rotating refresh tokens. Only a sha256 hash is stored, so a database dump
 * cannot be replayed. `family` lets us detect token reuse (theft) and revoke
 * the whole chain at once.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    deviceId: String,
    userAgent: String,
    ip: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: String,
    replacedByHash: String,
    usedAt: Date,
  },
  { timestamps: true }
);

// Mongo TTL index — expired rows vanish on their own, no cron needed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
