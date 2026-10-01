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

async function issueTokenPair(user, meta = {}) {
  const accessToken = signAccessToken(user);
  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: Math.floor(accessTokenExpiresInMs() / 1000),
    accessExpiresAt: new Date(Date.now() + accessTokenExpiresInMs()),
  };
}

module.exports = {
  signAccessToken,
  revokeAllForUser: async () => {},
  revokeDevice: async () => {},
  listActiveSessions: async () => [],
  issueTokenPair,
  accessTokenExpiresInMs,
};
