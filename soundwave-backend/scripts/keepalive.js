'use strict';

/**
 * Render free-tier keep-alive.
 * Render sleeps a web service after ~15 minutes without traffic; the next
 * request then pays a 30–60 s cold start. Pinging /health every 10 minutes
 * keeps the instance warm so the Android app never sees that delay.
 *
 * Usage (locally or from any free cron host such as cron-job.org / UptimeRobot):
 *   PUBLIC_BASE_URL=https://soundwave-api.onrender.com npm run keepalive
 */
require('dotenv').config();
const env = require('../src/config/env');

const url = `${(env.PUBLIC_BASE_URL || '').replace(/\/$/, '')}/health`;

if (!env.PUBLIC_BASE_URL) {
  console.error('Set PUBLIC_BASE_URL (e.g. https://soundwave-api.onrender.com) first.');
  process.exit(1);
}

console.log(`Keep-alive: pinging ${url} every ${Math.round(env.KEEPALIVE_INTERVAL_MS / 60000)} min`);

async function ping() {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => null);
    console.log(`[${new Date().toISOString()}] ${res.status} in ${Date.now() - started}ms`, body?.data?.uptimeSeconds ? `uptime=${body.data.uptimeSeconds}s` : '');
  } catch (err) {
    console.warn(`[${new Date().toISOString()}] ping failed: ${err.message}`);
  }
}

ping();
setInterval(ping, env.KEEPALIVE_INTERVAL_MS);
