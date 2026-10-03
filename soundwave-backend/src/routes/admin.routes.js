'use strict';

const express = require('express');
const mongoose = require('mongoose');
const { asyncHandler } = require('../utils/async');
const { ok, created } = require('../utils/apiResponse');
const { validate } = require('../middleware/validate');
const { authenticate, requireAdminKey } = require('../middleware/auth');
const pool = require('../services/upstreamPool');
const cache = require('../services/cache');
const db = require('../config/db');
const tracking = require('../services/trackingService');
const catalog = require('../services/catalog');
const playlistService = require('../services/playlistService');
const { sanitizeHtml, renderPlaceholders } = require('../services/sanitizer');
const oneSignal = require('../services/oneSignalService');
const User = require('../models/User');
const Song = require('../models/Song');
const PlayEvent = require('../models/PlayEvent');
const Entity = require('../models/Entity');
const Popup = require('../models/Popup');
const { NotificationTemplate, NotificationCampaign } = require('../models/NotificationCampaign');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

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
    const [users, songs, entities, events, sessions, popups, campaigns] = await Promise.all([
      User.countDocuments(),
      Song.countDocuments(),
      Entity.countDocuments(),
      PlayEvent.countDocuments(),
      mongoose.model('ListeningSession').countDocuments(),
      Popup.countDocuments(),
      NotificationCampaign.countDocuments(),
    ]);
    const topSongs = await Song.find({ 'metrics.ourPlays': { $gt: 0 } }).sort({ 'metrics.ourPlays': -1 }).limit(10).select('saavnId name metrics singers').lean();
    return ok(res, {
      database: db.status(),
      counts: { users, songs, entities, playEvents: events, listeningSessions: sessions, popups, campaigns },
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
    if (req.query.q) {
      filter.$or = [
        { name: new RegExp(req.query.q, 'i') },
        { email: new RegExp(req.query.q, 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('email name handle role status createdAt stats onboarding.completed preferences.languages').lean(),
      User.countDocuments(filter),
    ]);
    return ok(res, items, { total, page, limit });
  })
);

/* ── Popups Management ───────────────────────────────────────── */
router.post(
  '/popups/preview',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const { html, sampleUser } = req.body || {};
    const sanitized = sanitizeHtml(html);
    const rendered = renderPlaceholders(sanitized, sampleUser || { name: 'Asha Rao' });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;font-family:sans-serif;background:#0F0E17;color:#fff;">${rendered}</body></html>`);
  })
);

router.get(
  '/popups',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Number(req.query.page) || 1;
    const [items, total] = await Promise.all([
      Popup.find().sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Popup.countDocuments(),
    ]);
    return ok(res, items, { total, page, limit });
  })
);

router.post(
  '/popups',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const { name, html, enabled, audience } = req.body || {};
    const sanitized = sanitizeHtml(html);
    const doc = await Popup.create({
      name: name || 'Untitled Popup',
      html: sanitized,
      enabled: Boolean(enabled),
      audience: audience || { mode: 'all' },
      createdBy: req.user?._id,
    });
    return created(res, { popup: doc });
  })
);

router.patch(
  '/popups/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const updates = { ...req.body };
    if (updates.html) updates.html = sanitizeHtml(updates.html);
    const doc = await Popup.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    return ok(res, { popup: doc });
  })
);

router.delete(
  '/popups/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    await Popup.findByIdAndDelete(req.params.id);
    return ok(res, { id: req.params.id, deleted: true });
  })
);

/* ── Notification Templates & Campaigns ────────────────────────── */
router.get(
  '/notification-templates',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Number(req.query.page) || 1;
    const [items, total] = await Promise.all([
      NotificationTemplate.find().sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NotificationTemplate.countDocuments(),
    ]);
    return ok(res, items, { total, page, limit });
  })
);

router.post(
  '/notification-templates',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const doc = await NotificationTemplate.create({ ...req.body, createdBy: req.user?._id });
    return created(res, { template: doc });
  })
);

router.patch(
  '/notification-templates/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const doc = await NotificationTemplate.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    return ok(res, { template: doc });
  })
);

router.delete(
  '/notification-templates/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    await NotificationTemplate.findByIdAndDelete(req.params.id);
    return ok(res, { id: req.params.id, deleted: true });
  })
);

router.post(
  '/notifications/preview',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const { titleTemplate, bodyTemplate, imageUrl, action, sampleUser } = req.body || {};
    const sample = sampleUser || { name: 'Asha Rao' };
    const title = renderPlaceholders(titleTemplate || '', sample);
    const body = renderPlaceholders(bodyTemplate || '', sample);
    return ok(res, {
      preview: { title, body, imageUrl, action },
      sampleUser: sample,
    });
  })
);

router.get(
  '/notifications/campaigns',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const page = Number(req.query.page) || 1;
    const [items, total] = await Promise.all([
      NotificationCampaign.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NotificationCampaign.countDocuments(),
    ]);
    return ok(res, items, { total, page, limit });
  })
);

router.post(
  '/notifications/campaigns',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const doc = await NotificationCampaign.create({ ...req.body, createdBy: req.user?._id, status: 'draft' });
    return created(res, { campaign: doc });
  })
);

router.patch(
  '/notifications/campaigns/:id',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const doc = await NotificationCampaign.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean();
    return ok(res, { campaign: doc });
  })
);

router.post(
  '/notifications/campaigns/:id/send',
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const campaign = await NotificationCampaign.findById(req.params.id);
    if (!campaign) throw require('../utils/errors').AppError.notFound('Campaign not found');

    const snap = campaign.templateSnapshot || {};
    const isAll = campaign.audience?.mode === 'all';
    const userIds = isAll ? [] : (campaign.audience?.userIds || []);

    campaign.status = 'sending';
    await campaign.save();

    const pushResult = await oneSignal.sendNotification({
      userIds,
      title: snap.titleTemplate || 'Vinaraa',
      body: snap.bodyTemplate || '',
      imageUrl: snap.imageUrl,
      action: snap.action,
      isAll,
    });

    campaign.status = pushResult.sent ? 'sent' : 'failed';
    campaign.sentAt = new Date();
    campaign.recipientCount = pushResult.recipientCount || 0;
    await campaign.save();

    return ok(res, {
      campaignId: campaign._id,
      status: campaign.status,
      pushResult,
    });
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

router.post(
  '/maintenance/reap-stale-sessions',
  requireAdminKey,
  asyncHandler(async (req, res) => ok(res, await tracking.reapStaleSessions(Number(req.body?.maxAgeMinutes) || 30)))
);

router.post(
  '/maintenance/refresh-catalogue',
  requireAdminKey,
  asyncHandler(async (req, res) => ok(res, await catalog.refreshStaleSongs(Number(req.body?.limit) || 25)))
);

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
