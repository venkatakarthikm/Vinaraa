'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const Upstream = require('../models/Upstream');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UPSTREAM POOL  —  "my worker URL will expire"
 * ─────────────────────────────────────────────────────────────────────────────
 * Every JioSaavn host the backend can talk to lives in MongoDB (seeded from
 * UPSTREAM_URLS on first boot). Selecting a host is therefore DATA, not code.
 *
 *  • Add a new worker  : POST /api/v1/admin/upstreams           { url }
 *  • Swap/retire one   : PATCH /api/v1/admin/upstreams/:id      { enabled:false }
 *  • Re-order priority : PATCH /api/v1/admin/upstreams/:id      { priority: 1 }
 *  • Verify them all   : POST /api/v1/admin/upstreams/health-check
 *
 * Selection is priority-ordered with failover: a request walks the pool until
 * one host answers. A host that fails UPSTREAM_MAX_FAILURES times in a row is
 * put in a cooldown window (status=down) and skipped — so a dead worker costs
 * you one failed request, not every request. When every own host is down, the
 * optional public-mirror fallbacks are tried last.
 */

const MEMORY_TTL_MS = 15000;
let cacheSnapshot = null;
let cacheLoadedAt = 0;
let inFlightRefresh = null;

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const normalizeUrl = (url) => String(url || '').trim().replace(/\/+$/, '');

/** Seeds the pool from env on first boot (idempotent). */
async function seedFromEnv() {
  const urls = [...env.UPSTREAM_URLS];
  const created = [];
  let priority = 1;
  for (const raw of urls) {
    const url = normalizeUrl(raw);
    if (!url) continue;
    const existing = await Upstream.findOne({ url });
    if (existing) {
      priority += 1;
      continue;
    }
    const doc = await Upstream.create({
      url,
      pathPrefix: env.UPSTREAM_PATH_PREFIX,
      label: hostOf(url),
      priority,
      source: 'env',
      status: 'unknown',
      notes: 'Seeded from UPSTREAM_URLS',
    });
    created.push(doc);
    priority += 1;
  }
  for (let i = 0; i < env.UPSTREAM_FALLBACK_URLS.length; i += 1) {
    const url = normalizeUrl(env.UPSTREAM_FALLBACK_URLS[i]);
    if (!url) continue;
    const existing = await Upstream.findOne({ url });
    if (existing) continue;
    created.push(
      await Upstream.create({
        url,
        pathPrefix: env.UPSTREAM_FALLBACK_PATH_PREFIX,
        label: `${hostOf(url)} (fallback)`,
        priority: 900 + i,
        isFallback: true,
        source: 'env',
        notes: 'Public mirror fallback — used only when every own host is down',
      })
    );
  }
  if (created.length) logger.info('upstream pool seeded from env', { count: created.length });
  return created;
}

async function loadAll(force = false) {
  if (!force && cacheSnapshot && Date.now() - cacheLoadedAt < MEMORY_TTL_MS) return cacheSnapshot;
  cacheSnapshot = await Upstream.find({ enabled: true }).sort({ priority: 1, latencyMs: 1 }).lean();
  cacheLoadedAt = Date.now();
  return cacheSnapshot;
}

/** Ordered candidate list: own hosts (priority, then latency) → fallbacks last. */
async function pickAll() {
  const all = await loadAll();
  const usable = all.filter((u) => {
    if (u.cooldownUntil && new Date(u.cooldownUntil) > new Date()) return false;
    return true;
  });
  const own = usable.filter((u) => !u.isFallback);
  const fallbacks = usable.filter((u) => u.isFallback);
  const ordered = [...own, ...fallbacks];
  if (!ordered.length) throw AppError.upstream('No usable music upstream configured. Add one via /api/v1/admin/upstreams', { poolSize: all.length });
  return ordered;
}

async function getById(id) {
  const doc = await Upstream.findById(id);
  if (!doc) throw AppError.notFound('Upstream not found');
  return doc;
}

async function add({ url, pathPrefix, label, priority, notes, enabled = true }) {
  const clean = normalizeUrl(url);
  if (!/^https?:\/\//i.test(clean)) throw AppError.badRequest('url must start with http:// or https://');
  const existing = await Upstream.findOne({ url: clean });
  if (existing) throw AppError.conflict('This upstream URL already exists', 'DUPLICATE_KEY', { id: existing._id });
  const maxPriority = await Upstream.findOne().sort({ priority: -1 }).lean();
  const doc = await Upstream.create({
    url: clean,
    pathPrefix: pathPrefix ?? env.UPSTREAM_PATH_PREFIX,
    label: label || hostOf(clean),
    priority: priority ?? (maxPriority?.priority || 100) + 1,
    notes,
    enabled,
    source: 'admin',
  });
  cacheSnapshot = null;
  logger.info('upstream added', { url: clean });
  return doc;
}

async function update(id, patch) {
  const doc = await getById(id);
  const allowed = ['url', 'pathPrefix', 'label', 'notes', 'enabled', 'priority', 'weight', 'isFallback'];
  for (const k of allowed) if (patch[k] !== undefined) doc[k] = k === 'url' ? normalizeUrl(patch[k]) : patch[k];
  if (patch.enabled === true) {
    doc.cooldownUntil = undefined;
    doc.consecutiveFailures = 0;
    doc.status = 'unknown';
  }
  await doc.save();
  cacheSnapshot = null;
  return doc;
}

async function remove(id) {
  const doc = await getById(id);
  await Upstream.deleteOne({ _id: doc._id });
  cacheSnapshot = null;
  return doc;
}

/** Reports the outcome of a real request. Updates both DB counters and memory. */
async function report(id, { ok, latencyMs, error }) {
  const set = ok
    ? { $inc: { successCount: 1, totalRequests: 1 }, $set: { lastOkAt: new Date(), lastCheckedAt: new Date(), status: 'healthy', consecutiveFailures: 0, lastError: null }, $unset: { cooldownUntil: '' } }
    : { $inc: { failureCount: 1, consecutiveFailures: 1, totalRequests: 1 }, $set: { lastCheckedAt: new Date(), lastError: String(error || '').slice(0, 400) } };

  const doc = await Upstream.findById(id);
  if (!doc) return;
  doc.totalRequests += 1;
  if (ok) {
    doc.markSuccess(latencyMs || 0);
  } else {
    doc.markFailure(error);
    if (doc.consecutiveFailures >= env.UPSTREAM_MAX_FAILURES && !doc.isFallback) {
      logger.warn('upstream marked down — traffic will fail over', { url: doc.url, failures: doc.consecutiveFailures });
    }
  }
  await doc.save().catch(() => {});
  void set;
  cacheSnapshot = null;
}

/** Actively probes every enabled host (used by the admin route + optional cron). */
async function healthCheckAll() {
  const docs = await Upstream.find({ enabled: true });
  const results = [];
  for (const doc of docs) {
    const started = Date.now();
    const target = `${doc.url}${doc.pathPrefix || ''}${env.UPSTREAM_HEALTH_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(target, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'SoundWave-Backend/1.0' } });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch { /* non-JSON */ }
      const good = res.ok && json && json.success !== false;
      const latency = Date.now() - started;
      await report(doc._id, { ok: good, latencyMs: latency, error: good ? undefined : `HTTP ${res.status}` });
      results.push({ id: doc._id, url: doc.url, ok: good, status: res.status, latencyMs: latency });
    } catch (err) {
      const latency = Date.now() - started;
      await report(doc._id, { ok: false, latencyMs: latency, error: err.name === 'AbortError' ? 'timeout' : err.message });
      results.push({ id: doc._id, url: doc.url, ok: false, status: 0, latencyMs: latency, error: err.name === 'AbortError' ? 'timeout' : err.message });
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}

async function list(filter = {}) {
  return Upstream.find(filter).sort({ priority: 1 }).lean();
}

async function stats() {
  const docs = await list();
  return {
    total: docs.length,
    enabled: docs.filter((d) => d.enabled).length,
    healthy: docs.filter((d) => d.status === 'healthy').length,
    degraded: docs.filter((d) => d.status === 'degraded').length,
    down: docs.filter((d) => d.status === 'down').length,
    fallbacks: docs.filter((d) => d.isFallback).length,
    upstreams: docs.map((d) => ({
      id: d._id,
      url: d.url,
      pathPrefix: d.pathPrefix,
      status: d.status,
      enabled: d.enabled,
      priority: d.priority,
      latencyMs: d.latencyMs,
      requests: d.totalRequests,
      success: d.successCount,
      failure: d.failureCount,
      cooldownUntil: d.cooldownUntil,
      lastOkAt: d.lastOkAt,
      lastError: d.lastError,
    })),
  };
}

/** Startup diagnostic: warn when the configured host does not answer. */
async function bootstrapCheck() {
  try {
    const results = await healthCheckAll();
    const anyOk = results.some((r) => r.ok);
    if (!anyOk) logger.warn('no upstream answered the bootstrap health check — add/rotate a worker URL', { results });
    else logger.info('upstream pool healthy', { ok: results.filter((r) => r.ok).length, total: results.length });
    return results;
  } catch (err) {
    logger.warn('upstream bootstrap check failed', { err: err.message });
    return [];
  }
}

module.exports = {
  seedFromEnv,
  pickAll,
  loadAll,
  add,
  update,
  remove,
  getById,
  report,
  healthCheckAll,
  list,
  stats,
  bootstrapCheck,
  normalizeUrl,
  hostOf,
};
