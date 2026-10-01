'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { randomToken } = require('../utils/crypto');
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

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(user);
  const rawRefresh = randomToken(48);
  const family = randomToken(16);

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawRefresh),
    family,
    deviceId: meta.deviceId || 'unknown',
    userAgent: meta.userAgent || '',
    ip: meta.ip || '',
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    tokenType: 'Bearer',
    expiresIn: Math.floor(accessTokenExpiresInMs() / 1000),
    accessExpiresAt: new Date(Date.now() + accessTokenExpiresInMs()),
  };
}

/** Rotate a refresh token — issues new pair, revokes old, detects reuse. */
async function rotate(refreshToken, meta = {}) {
  if (!refreshToken) throw AppError.unauthorized('Refresh token required', 'REFRESH_INVALID');

  const doc = await RefreshToken.findOne({ tokenHash: hashToken(refreshToken) });
  if (!doc) throw AppError.unauthorized('Refresh token not found', 'REFRESH_INVALID');

  if (doc.revokedAt) {
    // Reuse detected — revoke entire family
    await RefreshToken.updateMany({ family: doc.family }, { revokedAt: new Date(), revokedReason: 'reuse' });
    throw AppError.unauthorized('Refresh token reused — all sessions revoked', 'SESSION_REVOKED');
  }

  if (doc.expiresAt <= new Date()) {
    throw AppError.unauthorized('Refresh token expired', 'REFRESH_EXPIRED');
  }

  // Revoke the used token
  doc.revokedAt = new Date();
  doc.revokedReason = 'rotated';
  await doc.save();

  const User = require('../models/User');
  const user = await User.findById(doc.user);
  if (!user) throw AppError.unauthorized('Account no longer exists', 'USER_NOT_FOUND');

  return issueTokenPair(user, { ...meta, deviceId: doc.deviceId });
}

async function revokeAllForUser(userId) {
  return RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'logout-all' }
  );
}

async function revokeDevice(userId, deviceId) {
  return RefreshToken.updateMany(
    { user: userId, deviceId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'device-logout' }
  );
}

async function listActiveSessions(userId) {
  return RefreshToken.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select('deviceId userAgent ip expiresAt createdAt')
    .lean();
}

module.exports = {
  signAccessToken,
  issueTokenPair,
  rotate,
  revokeAllForUser,
  revokeDevice,
  listActiveSessions,
  accessTokenExpiresInMs,
};
