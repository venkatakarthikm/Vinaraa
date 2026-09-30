'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

/**
 * NO-SQL-INJECTION STRATEGY (deliberately not mongoose's global sanitizeFilter)
 * ----------------------------------------------------------------------------
 * mongoose.set('sanitizeFilter', true) wraps ANY object-valued filter in $eq —
 * so our own legitimate operator queries ({ 'singers.id': { $in: [...] } },
 * { 'metrics.trendingScore': { $gt: 0 } }) become { $eq: { $in: [...] } } and
 * throw CastError on every request. Verified empirically: it 400s search,
 * trending, onboarding and playlists alike.
 *
 * Injection defence is layered instead:
 *   1. Every body / query / param is parsed by a zod schema that STRIPS unknown
 *      keys and coerces types, so an attacker cannot smuggle {$ne:null} in.
 *   2. ObjectIds are validated against /^[a-f\d]{24}$/i and song ids against a
 *      strict [A-Za-z0-9_-] pattern before they touch a query.
 *   3. strictQuery + typed schemas reject anything undeclared.
 *   4. All operators used in queries are written by us, never taken from input.
 */
mongoose.set('sanitizeFilter', false);

let connected = false;

async function connect(uri = env.MONGODB_URI) {
  if (connected) return mongoose.connection;

  mongoose.connection.on('connected', () => logger.info('mongo connected'));
  mongoose.connection.on('disconnected', () => {
    connected = false;
    logger.warn('mongo disconnected');
  });
  mongoose.connection.on('error', (err) => logger.error('mongo error', { err: err.message }));

  await mongoose.connect(uri, {
    maxPoolSize: env.MONGODB_MAX_POOL,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    // Atlas free tier friendly
    retryWrites: true,
    autoIndex: !env.isProd, // build indexes in dev; in prod run scripts/ensure-indexes
  });

  connected = true;
  return mongoose.connection;
}

async function disconnect() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

/** Build all collection indexes (including TTL indexes). Safe to call repeatedly. */
async function ensureIndexes() {
  const models = Object.values(mongoose.models);
  const results = [];
  for (const model of models) {
    try {
      await model.createIndexes();
      results.push({ model: model.modelName, ok: true });
    } catch (err) {
      results.push({ model: model.modelName, ok: false, error: err.message });
    }
  }
  return results;
}

function status() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null,
    host: mongoose.connection.host || null,
    models: Object.keys(mongoose.models).length,
  };
}

module.exports = { connect, disconnect, ensureIndexes, status, mongoose };
