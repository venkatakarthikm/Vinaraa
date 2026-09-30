'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { randomToken, sha256 } = require('../utils/crypto');
const RefreshToken = require('../models/RefreshToken');

const ISSUER = 'soundwave';
const AUDIENCE = 'soundwave-app';

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      tv: user.security?.tokenVersion || 0,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL, issuer: ISSUER, audience: AUDIENCE, algorithm: 'HS256' }
  );
}

const accessTokenExpiresInMs = () => {
  const ttl = env.ACCESS_TOKEN_TTL;
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) return 900000;
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return Number(m[1]) * mult;
};

/** Issues a brand-new refresh family (a fresh login). */
async function issueRefreshToken(user, { deviceId, ip, userAgent, family } = {}) {
  const raw = randomToken(48);
  const doc = await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(raw),
    family: family || randomToken(16),
    deviceId,
    ip,
    userAgent: String(userAgent || '').slice(0, 300),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
  });
  return { raw, doc };
}

/**
 * Rotating refresh. Single-use tokens + family reuse detection:
 * if a token that was already rotated is presented again, we assume theft and
 * revoke the entire family.
 */
async function rotateRefreshToken(rawToken, { ip, userAgent, deviceId } = {}) {
  if (!rawToken) throw AppError.unauthorized('Refresh token required', 'REFRESH_MISSING');
  const tokenHash = sha256(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) throw AppError.unauthorized('Invalid refresh token', 'REFRESH_INVALID');

  if (existing.revokedAt) {
    // Reuse of a rotated token → revoke every sibling in the family.
    await RefreshToken.updateMany(
      { family: existing.family, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'family_reuse_detected' } }
    );
    throw AppError.unauthorized('Refresh token reuse detected — all sessions in this family were revoked', 'REFRESH_REUSE');
  }
  if (existing.expiresAt <= new Date()) throw AppError.unauthorized('Refresh token expired', 'REFRESH_EXPIRED');

  const { raw, doc } = await issueRefreshToken(
    { _id: existing.user },
    { deviceId: deviceId || existing.deviceId, ip, userAgent, family: existing.family }
  );
  existing.revokedAt = new Date();
  existing.revokedReason = 'rotated';
  existing.usedAt = new Date();
  existing.replacedByHash = doc.tokenHash;
  await existing.save();

  return { raw, doc, userId: existing.user };
}

async function revokeRefreshToken(rawToken, reason = 'logout') {
  if (!rawToken) return null;
  return RefreshToken.updateOne({ tokenHash: sha256(rawToken), revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

async function revokeAllForUser(userId, reason = 'logout_all') {
  return RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

async function revokeDevice(userId, deviceId) {
  return RefreshToken.updateMany({ user: userId, deviceId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: 'device_removed' } });
}

async function listActiveSessions(userId) {
  return RefreshToken.find({ user: userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .select('deviceId ip userAgent createdAt expiresAt family')
    .lean();
}

/** Bundles the token pair the Android client stores in EncryptedSharedPreferences. */
async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const { raw: refreshToken } = await issueRefreshToken(user, meta);
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: Math.floor(accessTokenExpiresInMs() / 1000),
    accessExpiresAt: new Date(Date.now() + accessTokenExpiresInMs()),
    refreshExpiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
  };
}

module.exports = {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  revokeDevice,
  listActiveSessions,
  issueTokenPair,
  accessTokenExpiresInMs,
};
