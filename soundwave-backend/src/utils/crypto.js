'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

/** Opaque, high-entropy token (refresh tokens, device ids, api keys). */
const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');

/** Refresh tokens are stored ONLY as a sha256 hash — a DB leak cannot be replayed. */
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const hmac = (value, secret = env.JWT_REFRESH_SECRET) =>
  crypto.createHmac('sha256', secret).update(String(value)).digest('hex');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const hashPassword = (plain) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);

const verifyPassword = (plain, hash) => {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
};

/** Deterministic cache key from arbitrary args. */
function cacheKey(...parts) {
  return sha256(parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('|'));
}

module.exports = { randomToken, sha256, hmac, safeEqual, hashPassword, verifyPassword, cacheKey };
