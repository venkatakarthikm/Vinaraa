'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const CacheEntry = require('../models/CacheEntry');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO-TIER CACHE — no Redis
 * ─────────────────────────────────────────────────────────────────────────────
 *  Tier 1: in-process LRU with per-entry TTL (microseconds, no I/O).
 *  Tier 2: MongoDB TTL collection (survives restarts / cold starts on Render).
 *
 *  Also implements `swr()` — stale-while-revalidate. If the upstream JioSaavn
 *  host is dead but we hold an expired entry, we serve the stale payload and
 *  revalidate in the background instead of showing the user an error. That is
 *  what keeps the app browsable while you swap worker URLs.
 */

class LRU {
  constructor(max = 1000) {
    this.max = max;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      // keep it around as a stale copy, but report a miss
      entry.stale = true;
      this.misses += 1;
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry); // re-insert = most recently used
    this.hits += 1;
    return entry.value;
  }

  /** Raw read that also returns expired values (used by stale-while-revalidate). */
  peek(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    return { value: entry.value, expired: entry.expiresAt <= Date.now() };
  }

  set(key, value, ttlSeconds) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }
}

const lru = new LRU(env.CACHE_MAX_ENTRIES);
const stats = { hits: 0, misses: 0, l2Hits: 0, l2Writes: 0, staleServed: 0, errors: 0 };

const nsKey = (namespace, key) => `${namespace}:${typeof key === 'string' ? key : JSON.stringify(key)}`;

async function get(namespace, key) {
  const k = nsKey(namespace, key);
  const local = lru.get(k);
  if (local !== undefined) {
    stats.hits += 1;
    return local;
  }
  if (!env.CACHE_MONGO_TIER) return undefined;
  try {
    const doc = await CacheEntry.findOne({ key: k, expiresAt: { $gt: new Date() } }).lean();
    if (doc) {
      stats.l2Hits += 1;
      lru.set(k, doc.value, Math.max(1, Math.floor((new Date(doc.expiresAt).getTime() - Date.now()) / 1000)));
      CacheEntry.updateOne({ key: k }, { $inc: { hits: 1 } }).catch(() => {});
      return doc.value;
    }
  } catch (err) {
    stats.errors += 1;
    logger.debug('cache L2 read failed', { err: err.message });
  }
  return undefined;
}

async function set(namespace, key, value, ttlSeconds, kind = namespace) {
  const k = nsKey(namespace, key);
  lru.set(k, value, ttlSeconds);
  if (!env.CACHE_MONGO_TIER) return value;
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await CacheEntry.updateOne(
      { key: k },
      { $set: { value, expiresAt, kind, bytes: JSON.stringify(value || null).length }, $setOnInsert: { hits: 0 } },
      { upsert: true }
    );
    stats.l2Writes += 1;
  } catch (err) {
    stats.errors += 1;
    logger.debug('cache L2 write failed', { err: err.message });
  }
  return value;
}

/** Cache-aside helper. */
async function wrap(namespace, key, ttlSeconds, producer, kind) {
  const hit = await get(namespace, key);
  if (hit !== undefined) return hit;
  const value = await producer();
  if (value !== undefined && value !== null) await set(namespace, key, value, ttlSeconds, kind);
  return value;
}

/**
 * Stale-while-revalidate. Never throws because of the upstream: if the producer
 * fails and any stale copy exists, the stale copy wins.
 */
async function swr(namespace, key, ttlSeconds, producer, kind) {
  const k = nsKey(namespace, key);
  const fresh = lru.get(k);
  if (fresh !== undefined) {
    stats.hits += 1;
    return { value: fresh, stale: false };
  }

  let stale;
  if (env.CACHE_MONGO_TIER) {
    try {
      const doc = await CacheEntry.findOne({ key: k }).lean();
      if (doc) stale = { value: doc.value, expired: new Date(doc.expiresAt) <= new Date() };
    } catch { /* ignore */ }
  }
  if (!stale) stale = lru.peek(k);

  if (stale && !stale.expired) {
    lru.set(k, stale.value, Math.max(1, ttlSeconds));
    return { value: stale.value, stale: false };
  }

  try {
    const value = await producer();
    if (value !== undefined && value !== null) await set(namespace, key, value, ttlSeconds, kind);
    return { value, stale: false };
  } catch (err) {
    if (stale && stale.value !== undefined) {
      stats.staleServed += 1;
      logger.warn('serving stale cache after upstream failure', { namespace, key: String(key).slice(0, 80), err: err.message });
      return { value: stale.value, stale: true, error: err.message };
    }
    throw err;
  }
}

async function invalidate(namespace, key) {
  const k = nsKey(namespace, key);
  lru.delete(k);
  if (env.CACHE_MONGO_TIER) await CacheEntry.deleteOne({ key: k }).catch(() => {});
}

/** Purges every entry of a namespace (e.g. after adding an upstream). */
async function invalidateNamespace(namespace) {
  for (const k of [...lru.map.keys()]) if (k.startsWith(`${namespace}:`)) lru.delete(k);
  if (env.CACHE_MONGO_TIER) await CacheEntry.deleteMany({ kind: namespace }).catch(() => {});
}

async function sweep() {
  if (!env.CACHE_MONGO_TIER) return 0;
  const res = await CacheEntry.sweep();
  return res.deletedCount || 0;
}

function getStats() {
  const total = stats.hits + stats.misses;
  return {
    layer1: { entries: lru.size, max: env.CACHE_MAX_ENTRIES, hits: stats.hits, misses: stats.misses },
    layer2: { enabled: env.CACHE_MONGO_TIER, reads: stats.l2Hits, writes: stats.l2Writes },
    staleServed: stats.staleServed,
    errors: stats.errors,
    hitRate: total > 0 ? Number((stats.hits / total).toFixed(4)) : 0,
  };
}

module.exports = {
  get,
  set,
  wrap,
  swr,
  invalidate,
  invalidateNamespace,
  sweep,
  getStats,
  lru,
  resetStats: () => Object.keys(stats).forEach((k) => { stats[k] = 0; }),
};
