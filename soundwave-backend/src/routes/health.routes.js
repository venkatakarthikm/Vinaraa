'use strict';

const express = require('express');
const env = require('../config/env');
const { asyncHandler } = require('../utils/async');
const { ok } = require('../utils/apiResponse');
const db = require('../config/db');
const pool = require('../services/upstreamPool');
const cache = require('../services/cache');
const saavn = require('../services/saavnClient');

const router = express.Router();
const startedAt = Date.now();

/** Liveness — for Render/Render health checks and the keep-alive ping. */
router.get('/', (_req, res) =>
  ok(res, {
    service: 'soundwave-backend',
    status: 'ok',
    version: require('../../package.json').version,
    env: env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  })
);

/** Readiness — DB must be up. */
router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const database = db.status();
    const ready = database.state === 'connected';
    return res.status(ready ? 200 : 503).json({
      success: ready,
      data: { ready, database },
    });
  })
);

/** Full diagnostics: DB, cache, upstream pool, memory. */
router.get(
  '/diagnostics',
  asyncHandler(async (_req, res) => {
    const upstreamStats = await pool.stats().catch(() => ({ error: 'unavailable' }));
    return ok(res, {
      database: db.status(),
      cache: cache.getStats(),
      upstreams: upstreamStats,
      memory: process.memoryUsage(),
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      node: process.version,
    });
  })
);

/** Live upstream probe (no auth — reports only reachability). */
router.get(
  '/upstream',
  asyncHandler(async (_req, res) => {
    const results = await pool.healthCheckAll();
    return res.status(results.some((r) => r.ok) ? 200 : 502).json({
      success: results.some((r) => r.ok),
      data: { results },
    });
  })
);

/** Quick end-to-end probe: does a real search work right now? */
router.get(
  '/upstream/search',
  asyncHandler(async (_req, res) => {
    try {
      const { data, upstream } = await saavn.searchSongs('arijit singh', 0, 1);
      return ok(res, {
        working: true,
        upstream,
        sample: data?.data?.results?.[0]?.name || null,
      });
    } catch (err) {
      return res.status(502).json({ success: false, error: { code: 'UPSTREAM_UNAVAILABLE', message: err.message } });
    }
  })
);

module.exports = router;
