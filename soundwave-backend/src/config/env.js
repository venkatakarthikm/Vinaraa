'use strict';

require('dotenv').config();

const bool = (v, d = false) => (v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const list = (v, d = []) =>
  (v === undefined || v === '' ? d : String(v).split(',').map((s) => s.trim()).filter(Boolean));

const DEFAULTS = {
  JWT_ACCESS_SECRET: 'dev-only-access-secret-change-me-please-0000000000',
  JWT_REFRESH_SECRET: 'dev-only-refresh-secret-change-me-please-000000000',
  ADMIN_API_KEY: 'dev-only-admin-key-change-me',
};

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  PORT: num(process.env.PORT, 8080),
  TRUST_PROXY: num(process.env.TRUST_PROXY, 1),

  // ── Database ────────────────────────────────────────────────
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/soundwave',
  MONGODB_MAX_POOL: num(process.env.MONGODB_MAX_POOL, 10),

  // ── Auth ────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || DEFAULTS.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || DEFAULTS.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || '365d',
  REFRESH_TOKEN_TTL_DAYS: num(process.env.REFRESH_TOKEN_TTL_DAYS, 365),
  BCRYPT_ROUNDS: num(process.env.BCRYPT_ROUNDS, 12),

  // ── Upstream JioSaavn pool ──────────────────────────────────
  UPSTREAM_URLS: list(process.env.UPSTREAM_URLS, ['https://jiosaavn-api.apicoolie.workers.dev']),
  UPSTREAM_PATH_PREFIX: process.env.UPSTREAM_PATH_PREFIX ?? '/api',
  UPSTREAM_TIMEOUT_MS: num(process.env.UPSTREAM_TIMEOUT_MS, 9000),
  UPSTREAM_HEALTH_PATH: process.env.UPSTREAM_HEALTH_PATH || '/search/songs?query=arijit%20singh&limit=1',
  UPSTREAM_COOLDOWN_MS: num(process.env.UPSTREAM_COOLDOWN_MS, 60000),
  UPSTREAM_MAX_FAILURES: num(process.env.UPSTREAM_MAX_FAILURES, 3),
  UPSTREAM_FALLBACK_URLS: list(process.env.UPSTREAM_FALLBACK_URLS, []),
  UPSTREAM_FALLBACK_PATH_PREFIX: process.env.UPSTREAM_FALLBACK_PATH_PREFIX || '/api',

  // ── Cache ───────────────────────────────────────────────────
  CACHE_MAX_ENTRIES: num(process.env.CACHE_MAX_ENTRIES, 3000),
  CACHE_TTL_SEARCH: num(process.env.CACHE_TTL_SEARCH, 300),
  CACHE_TTL_SONG: num(process.env.CACHE_TTL_SONG, 1800),
  CACHE_TTL_ENTITY: num(process.env.CACHE_TTL_ENTITY, 3600),
  CACHE_TTL_STREAM_URL: num(process.env.CACHE_TTL_STREAM_URL, 600),
  CACHE_MONGO_TIER: bool(process.env.CACHE_MONGO_TIER, true),

  // ── Rate limits ─────────────────────────────────────────────
  RATE_LIMIT_GLOBAL_MAX: num(process.env.RATE_LIMIT_GLOBAL_MAX, 600),
  RATE_LIMIT_GLOBAL_WINDOW_MIN: num(process.env.RATE_LIMIT_GLOBAL_WINDOW_MIN, 15),
  RATE_LIMIT_AUTH_MAX: num(process.env.RATE_LIMIT_AUTH_MAX, 20),
  RATE_LIMIT_AUTH_WINDOW_MIN: num(process.env.RATE_LIMIT_AUTH_WINDOW_MIN, 15),
  RATE_LIMIT_WRITE_MAX: num(process.env.RATE_LIMIT_WRITE_MAX, 240),
  RATE_LIMIT_WRITE_WINDOW_MIN: num(process.env.RATE_LIMIT_WRITE_WINDOW_MIN, 15),

  // ── Security ────────────────────────────────────────────────
  CORS_ORIGINS: list(process.env.CORS_ORIGINS, ['*']),
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || DEFAULTS.ADMIN_API_KEY,

  // ── Recommendation weights (movie -> hero -> language -> singer -> director) ──
  RECO_W_MOVIE: num(process.env.RECO_W_MOVIE, 0.30),
  RECO_W_HERO: num(process.env.RECO_W_HERO, 0.22),
  RECO_W_LANGUAGE: num(process.env.RECO_W_LANGUAGE, 0.18),
  RECO_W_SINGER: num(process.env.RECO_W_SINGER, 0.16),
  RECO_W_DIRECTOR: num(process.env.RECO_W_DIRECTOR, 0.14),
  RECO_MIN_LISTEN_MS: num(process.env.RECO_MIN_LISTEN_MS, 30000),
  RECO_PLAY_RATIO: num(process.env.RECO_PLAY_RATIO, 0.5),

  // ── Retention ───────────────────────────────────────────────
  TTL_PLAY_EVENTS_DAYS: num(process.env.TTL_PLAY_EVENTS_DAYS, 180),
  TTL_SEARCH_HISTORY_DAYS: num(process.env.TTL_SEARCH_HISTORY_DAYS, 180),
  TTL_RAW_SESSION_DAYS: num(process.env.TTL_RAW_SESSION_DAYS, 30),
  TTL_CACHE_DAYS: num(process.env.TTL_CACHE_DAYS, 7),

  // ── Keep-alive ──────────────────────────────────────────────
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || '',
  KEEPALIVE_INTERVAL_MS: num(process.env.KEEPALIVE_INTERVAL_MS, 600000),
};

env.recoWeights = {
  movie: env.RECO_W_MOVIE,
  hero: env.RECO_W_HERO,
  language: env.RECO_W_LANGUAGE,
  singer: env.RECO_W_SINGER,
  director: env.RECO_W_DIRECTOR,
};

/** Fail loudly instead of silently shipping dev secrets to production. */
env.assertProductionSecrets = function assertProductionSecrets() {
  if (!env.isProd) return [];
  const problems = [];
  for (const [key, devDefault] of Object.entries(DEFAULTS)) {
    if (env[key] === devDefault) problems.push(`${key} is still the development default`);
  }
  if (!env.MONGODB_URI.startsWith('mongodb')) problems.push('MONGODB_URI is not a mongodb connection string');
  return problems;
};

module.exports = env;
