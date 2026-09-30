'use strict';

/**
 * Builds every collection index, including the TTL indexes used for retention.
 * Run once after the first deploy, and again whenever a model changes:
 *   npm run db:indexes
 */
require('dotenv').config();
require('../src/models/User');
require('../src/models/RefreshToken');
require('../src/models/Upstream');
require('../src/models/Song');
require('../src/models/Entity');
require('../src/models/Playlist');
require('../src/models/PlayEvent');
require('../src/models/ListeningSession');
require('../src/models/DailyStat');
require('../src/models/SearchHistory');
require('../src/models/CacheEntry');

const db = require('../src/config/db');
const logger = require('../src/utils/logger');

(async () => {
  await db.connect();
  const results = await db.ensureIndexes();
  const failed = results.filter((r) => !r.ok);
  logger.info('index build complete', { total: results.length, failed: failed.length });
  if (failed.length) logger.warn('indexes that failed', { failed });
  await db.disconnect();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  logger.error('index build failed', { err: err.message });
  process.exit(1);
});
