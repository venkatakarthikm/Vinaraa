'use strict';

const env = require('./config/env');
const logger = require('./utils/logger');
const db = require('./config/db');
const { createApp } = require('./app');
const pool = require('./services/upstreamPool');
const cache = require('./services/cache');
const tracking = require('./services/trackingService');

const app = createApp();
let server;
const timers = [];

async function bootstrap() {
  const problems = env.assertProductionSecrets();
  if (problems.length) {
    logger.error('refusing to start: insecure production configuration', { problems });
    process.exit(1);
  }
  if (!env.isProd) logger.warn('running in development mode — set NODE_ENV=production on Render/Cloudflare');

  await db.connect();
  const indexResults = await db.ensureIndexes();
  const failedIndexes = indexResults.filter((r) => !r.ok);
  if (failedIndexes.length) logger.warn('some indexes failed to build', { failedIndexes });

  await pool.seedFromEnv();

  server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info('soundwave backend listening', { port: env.PORT, pid: process.pid });
    logger.info('fix a dead worker URL: POST /api/v1/admin/upstreams with x-admin-key');
  });

  scheduleBackgroundJobs();

  // Non-blocking upstream probe so a broken/stale worker URL is reported in logs.
  setTimeout(() => {
    pool.bootstrapCheck().catch((err) => logger.warn('bootstrap upstream check failed', { err: err.message }));
  }, 1500);

  if (env.PUBLIC_BASE_URL) startKeepAlive();
  return server;
}

function scheduleBackgroundJobs() {
  // Close sessions abandoned by a killed app (keeps stats honest).
  timers.push(
    setInterval(() => tracking.reapStaleSessions(30).catch((err) => logger.debug('reap failed', { err: err.message })), 15 * 60 * 1000)
  );
  // Drop expired cache rows that the TTL monitor may not have collected yet.
  timers.push(setInterval(() => cache.sweep().catch(() => {}), 60 * 60 * 1000));
}

/**
 * Render's free tier sleeps after ~15 minutes idle, and a cold start costs the
 * user 30–60 s. A self-ping every 10 minutes keeps the instance warm.
 */
function startKeepAlive() {
  const url = `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/health`;
  timers.push(
    setInterval(async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        logger.debug('keep-alive ping', { status: res.status });
      } catch (err) {
        logger.debug('keep-alive ping failed', { err: err.message });
      }
    }, env.KEEPALIVE_INTERVAL_MS)
  );
  logger.info('keep-alive enabled', { url, everyMs: env.KEEPALIVE_INTERVAL_MS });
}

async function shutdown(signal) {
  logger.info('shutting down', { signal });
  timers.forEach(clearInterval);
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.disconnect().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error('unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) }));
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception — exiting', { err: err.message, stack: err.stack });
  shutdown('uncaughtException');
});

if (require.main === module) {
  bootstrap().catch((err) => {
    logger.error('failed to start', { err: err.message, stack: err.stack });
    process.exit(1);
  });
}

module.exports = { bootstrap, app };
