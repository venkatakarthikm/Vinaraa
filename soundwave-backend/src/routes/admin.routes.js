'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../utils/async');
const { ok } = require('../utils/apiResponse');
const { validate } = require('../middleware/validate');
const { requireAdminKey } = require('../middleware/auth');
const pool = require('../services/upstreamPool');
const cache = require('../services/cache');
const db = require('../config/db');
const tracking = require('../services/trackingService');
const catalog = require('../services/catalog');
const playlistService = require('../services/playlistService');
const User = require('../models/User');
const Song = require('../models/Song');
const PlayEvent = require('../models/PlayEvent');
const Entity = require('../models/Entity');
const s = require('../validators/schemas');

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN  —  this is where "my worker URL expired" is fixed in 5 seconds.
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth: `x-admin-key: <ADMIN_API_KEY>` header (or an admin JWT).
 *
 *   curl -X POST https://your-api/api/v1/admin/upstreams \
 *        -H "x-admin-key: $ADMIN_API_KEY" -H 'content-type: application/json' \
 *        -d '{"url":"https://my-new-worker.workers.dev","pathPrefix":"/api"}'
 *
 * Then optionally disable the dead one:
 *   curl -X PATCH .../admin/upstreams/<id> -d '{"enabled":false}'
 *
 * No redeploy, no downtime, no client update.
 */

/* ── upstream pool ───────────────────────────────────────────── */
router.get(
  '/upstreams',
  requireAdminKey,
  asyncHandler(async (_req, res) => ok(res, await pool.list()))
);

router.get(
  '/upstreams/stats',
  requireAdminKey,
  asyncHandler(async (_req, res) => ok(res, await pool.stats()))
);

router.post(
  '/upstreams',
  requireAdminKey,
  validate(s.addUpstreamSchema),
  asyncHandler(async (req, res) => {
    const doc = await pool.add(req.body);
    const probe = await require('../services/saavnClient').probeHost(doc).catch(() => ({ ok: false }));
    if (probe.ok) await pool.report(doc._id, { ok: true, latencyMs: probe.latencyMs });
    else await pool.report(doc._id, { ok: false, error: probe.error });
    await cache.invalidateNamespace('search:songs').catch(() => {});
    return ok(res, { upstream: doc.toPublicJSON(), probe, next: probe.ok ? 'Ready — traffic will use this host immediately.' : 'Added, but the probe failed. Check pathPrefix (this worker needs "/api").' });
  })
);

router.patch(
  '/upstreams/:id',
  requireAdminKey,
  validate(s.updateUpstreamSchema),
  asyncHandler(async (req, res) => {
    const doc = await pool.update(req.params.id, req.body);
    return ok(res, doc.toPublicJSON());
  })
);

router.delete(
  '/upstreams/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const doc = await pool.remove(req.params.id);
    return ok(res, { removed: doc.url, id: doc._id });
  })
);

/** Probe every configured host and update health/latency. */
router.post(
  '/upstreams/health-check',
  requireAdminKey,
  asyncHandler(async (_req, res) => ok(res, { results: await pool.healthCheckAll() }))
);

/** Re-orders the pool by measured latency (fastest first). */
router.post(
  '/upstreams/optimize',
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    await pool.healthCheckAll();
    const docs = await pool.list({ isFallback: false });
    const sorted = [...docs].sort((a, b) => (a.latencyMs || 99999) - (b.latencyMs || 99999));
    await Promise.all(sorted.map((d, i) => pool.update(d._id, { priority: i + 1 })));
    return ok(res, { order: sorted.map((d) => ({ url: d.url, priority: (sorted.indexOf(d) + 1), latencyMs: d.latencyMs })) });
  })
);

/* ── platform stats ─────────────────────────────────────────── */
router.get(
  '/stats',
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const [users, songs, entities, events, sessions] = await Promise.all([
      User.countDocuments(),
      Song.countDocuments(),
      Entity.countDocuments(),
      PlayEvent.countDocuments(),
      mongoose.model('ListeningSession').countDocuments(),
    ]);
    const topSongs = await Song.find({ 'metrics.ourPlays': { $gt: 0 } }).sort({ 'metrics.ourPlays': -1 }).limit(10).select('saavnId name metrics singers').lean();
    return ok(res, {
      database: db.status(),
      counts: { users, songs, entities, playEvents: events, listeningSessions: sessions },
      cache: cache.getStats(),
      upstreams: await pool.stats(),
      topSongsByOurPlays: topSongs.map((x) => ({ id: x.saavnId, name: x.name, plays: x.metrics?.ourPlays, listenedMs: x.metrics?.ourListenedMs, trendingScore: x.metrics?.trendingScore })),
    });
  })
);

router.get(
  '/users',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const page = Number(req.query.page) || 1;
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('email name handle status createdAt stats onboarding.completed preferences.languages').lean(),
      User.countDocuments(filter),
    ]);
    return ok(res, items, { total, page, limit });
  })
);

/* ── maintenance ────────────────────────────────────────────── */
router.post(
  '/maintenance/ensure-indexes',
  requireAdminKey,
  asyncHandler(async (_req, res) => ok(res, { results: await db.ensureIndexes() }))
);

router.post(
  '/maintenance/sweep-cache',
  requireAdminKey,
  asyncHandler(async (_req, res) => ok(res, { deleted: await cache.sweep(), stats: cache.getStats() }))
);

router.post(
  '/maintenance/refresh-cache',
  requireAdminKey,
  asyncHandler(async (req, res) => ok(res, { cleared: await cache.invalidateNamespace(req.body?.namespace || 'search:songs').then(() => true) }))
);

/** Closes sessions left open by a killed app — keeps analytics honest. */
router.post(
  '/maintenance/reap-stale-sessions',
  requireAdminKey,
  asyncHandler(async (req, res) => ok(res, await tracking.reapStaleSessions(Number(req.body?.maxAgeMinutes) || 30)))
);

/** Refreshes stale song metadata from the upstream (bounded, safe to cron). */
router.post(
  '/maintenance/refresh-catalogue',
  requireAdminKey,
  asyncHandler(async (req, res) => ok(res, await catalog.refreshStaleSongs(Number(req.body?.limit) || 25)))
);

/** Rebuilds system playlists for every user (e.g. after tuning reco weights). */
router.post(
  '/maintenance/rebuild-system-playlists',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const limit = Number(req.body?.limit) || 50;
    const users = await User.find({ status: 'active' }).sort({ 'stats.lastActiveAt': -1 }).limit(limit);
    const results = [];
    for (const user of users) {
      const onRepeat = await playlistService.refreshOnRepeat(user, { limit: 30 }).catch(() => null);
      const tasteMix = await playlistService.refreshTasteMix(user, { limit: 40 }).catch(() => null);
      results.push({ userId: user._id, onRepeat: onRepeat?.trackCount ?? null, tasteMix: tasteMix?.trackCount ?? null });
    }
    return ok(res, { processed: results.length, results });
  })
);

/** Recomputes trendingScore from measured listening (hourly cron candidate). */
router.post(
  '/maintenance/recompute-trending',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - (Number(req.body?.days) || 7) * 86400000);
    const rows = await PlayEvent.aggregate([
      { $match: { createdAt: { $gte: since }, listenedMs: { $gt: 0 } } },
      { $group: { _id: '$songId', listenedMs: { $sum: '$listenedMs' }, plays: { $sum: 1 }, completions: { $sum: { $cond: ['$completed', 1, 0] } } } },
    ]);
    const ops = rows.map((r) => ({
      updateOne: {
        filter: { saavnId: String(r._id) },
        update: { $set: { 'metrics.trendingScore': Math.round(r.listenedMs / 60000) + r.plays * 5 + r.completions * 3, 'metrics.ourPlays': r.plays, 'metrics.ourListenedMs': r.listenedMs } },
      },
    }));
    if (ops.length) await Song.bulkWrite(ops, { ordered: false });
    return ok(res, { songsUpdated: ops.length, windowDays: Number(req.body?.days) || 7 });
  })
);

module.exports = router;
