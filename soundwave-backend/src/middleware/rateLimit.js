'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

/**
 * In-memory sliding-window limiters (no Redis, per the brief).
 * Keys are per-user when authenticated, otherwise per-IP — so one noisy device
 * cannot exhaust the quota of everybody behind the same NAT.
 */
const keyGenerator = (req) => (req.user?._id ? `u:${req.user._id}` : `ip:${req.ip}`);

const handler = (_req, _res, next) => next(AppError.tooMany('Too many requests, slow down and retry shortly'));

function build({ windowMinutes, max, name }) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler,
    skip: (req) => req.path === '/health' || req.method === 'OPTIONS',
    // The default store is per-process memory — exactly what "no Redis" allows.
    requestPropertyName: `rateLimit_${name}`,
  });
}

const globalLimiter = build({
  name: 'global',
  windowMinutes: env.RATE_LIMIT_GLOBAL_WINDOW_MIN,
  max: env.RATE_LIMIT_GLOBAL_MAX,
});

const authLimiter = build({
  name: 'auth',
  windowMinutes: env.RATE_LIMIT_AUTH_WINDOW_MIN,
  max: env.RATE_LIMIT_AUTH_MAX,
});

const writeLimiter = build({
  name: 'write',
  windowMinutes: env.RATE_LIMIT_WRITE_WINDOW_MIN,
  max: env.RATE_LIMIT_WRITE_MAX,
});

/** Stricter limiter for the endpoints that fan out to the JioSaavn upstream. */
const upstreamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler,
});

module.exports = { globalLimiter, authLimiter, writeLimiter, upstreamLimiter };
