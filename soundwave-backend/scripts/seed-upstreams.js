'use strict';

/**
 * Seeds / refreshes the upstream pool from UPSTREAM_URLS.
 * Run after changing .env:  npm run seed:upstreams
 */
require('dotenv').config();
const db = require('../src/config/db');
const pool = require('../src/services/upstreamPool');
const logger = require('../src/utils/logger');

(async () => {
  await db.connect();
  const created = await pool.seedFromEnv();
  const all = await pool.list();
  logger.info('upstream pool', {
    created: created.length,
    total: all.length,
    hosts: all.map((u) => ({ url: u.url, pathPrefix: u.pathPrefix, priority: u.priority, enabled: u.enabled })),
  });
  const results = await pool.healthCheckAll();
  logger.info('health check results', { results });
  await db.disconnect();
  process.exit(results.some((r) => r.ok) ? 0 : 1);
})().catch((err) => {
  logger.error('seed failed', { err: err.message });
  process.exit(1);
});
