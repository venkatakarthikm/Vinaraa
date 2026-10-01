'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const pool = require('./upstreamPool');

/**
 * Thin client over the JioSaavn worker pool.
 * Every outbound call: pool order → fetch with timeout → failover → cache.
 *
 * Route shape of this worker (verified live):  {UPSTREAM_URL}{/api}{/search/songs?query=…}
 *   /api/search/songs?query=&page=&limit=
 *   /api/search/albums|artists|playlists?query=&page=&limit=
 *   /api/songs?id=|/api/songs/:id   /api/albums?id=  /api/artists?id=  /api/playlists?id=
 *   /api/songs/:id/lyrics
 */

const DEFAULT_TIMEOUT = env.UPSTREAM_TIMEOUT_MS;

/** Marks the outcome on every host we tried, so health learns from real traffic. */
async function fetchFromHost(host, path, { timeoutMs = DEFAULT_TIMEOUT, retries = 0 } = {}) {
  const url = `${host.url}${host.pathPrefix || ''}${path}`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'en-IN,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (Linux; Android 14) SoundWave/1.0',
      },
    });
    const latency = Date.now() - started;
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`non-JSON response (HTTP ${res.status})`);
    }
    if (!res.ok || json.success === false) {
      const message = json?.message || `HTTP ${res.status}`;
      throw Object.assign(new Error(message), { status: res.status, upstreamBody: json });
    }
    await pool.report(host._id, { ok: true, latencyMs: latency });
    return { data: json, host, latencyMs: latency };
  } catch (err) {
    const aborted = err.name === 'AbortError';
    await pool.report(host._id, { ok: false, latencyMs: Date.now() - started, error: aborted ? `timeout after ${timeoutMs}ms` : err.message });
    if (retries > 0) {
      return fetchFromHost(host, path, { timeoutMs: Math.min(timeoutMs + 3000, 20000), retries: retries - 1 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Core request: tries every usable host in priority order.
 * Returns the parsed JSON plus a `_upstream` diagnostic block.
 */
async function request(path, opts = {}) {
  const hosts = await pool.pickAll();
  const failures = [];
  for (const host of hosts) {
    try {
      const { data, latencyMs } = await fetchFromHost(host, path, opts);
      return {
        data,
        upstream: { host: host.url, hostId: host._id, label: host.label, latencyMs, failovers: failures.length, failures },
      };
    } catch (err) {
      failures.push({ url: host.url, error: err.message });
      logger.debug('upstream attempt failed, failing over', { url: host.url, path, err: err.message });
    }
  }
  throw AppError.upstream(`Every music upstream failed for ${path}`, { attempts: failures });
}

/* ── Typed helpers: the only way the rest of the codebase talks to JioSaavn ── */

const qs = (params) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

const searchSongs = (query, page = 0, limit = 20) => request(`/search/songs${qs({ query, page, limit })}`);
const searchAlbums = (query, page = 0, limit = 20) => request(`/search/albums${qs({ query, page, limit })}`);
const searchArtists = (query, page = 0, limit = 20) => request(`/search/artists${qs({ query, page, limit })}`);
const searchPlaylists = (query, page = 0, limit = 20) => request(`/search/playlists${qs({ query, page, limit })}`);

/** This worker accepts both /songs?id= and /songs/:id — we prefer the path form. */
const songsById = (id) => request(`/songs/${encodeURIComponent(id)}${qs({ songdata: 'true' })}`);
/**
 * Bulk fetch. The worker's comma form (/songs?id=a,b) is unreliable — it
 * returns only the first id (verified against the live worker), so we fan out
 * to the verified path form (/songs/:id) in parallel and merge. Partial success
 * is accepted: whatever resolves is returned; we only fail when NOTHING did.
 */
async function songsByIds(ids = []) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return { data: { success: true, data: [] }, upstream: null };

  const settled = await Promise.allSettled(unique.map((id) => songsById(id)));
  const data = [];
  const failures = [];
  let upstream = null;

  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const payload = result.value.data?.data;
      const list = Array.isArray(payload) ? payload : [payload];
      data.push(...list.filter(Boolean));
      if (!upstream) upstream = result.value.upstream;
    } else {
      failures.push({ id: unique[i], error: result.reason?.message || 'unknown' });
    }
  });

  if (!data.length && failures.length) {
    throw AppError.upstream('Could not fetch any of the requested songs', { failures });
  }
  return { data: { success: true, data }, upstream: { ...(upstream || { host: 'mixed' }), failures } };
}

const albumById = (id) => request(`/albums${qs({ id })}`);
const artistById = (id, page = 0) => request(`/artists${qs({ id, page })}`);
const playlistById = (id, limit = 100) => request(`/playlists${qs({ id, limit })}`);
const songLyrics = (id) => request(`/songs/${encodeURIComponent(id)}/lyrics`);
const modules = (language) => request(`/modules${qs({ language })}`);

/** Pings a specific host without touching the pool — used by the admin probe. */
async function probeHost(host) {
  const started = Date.now();
  try {
    const { data } = await fetchFromHost(host, env.UPSTREAM_HEALTH_PATH, { timeoutMs: 8000 });
    return { ok: true, latencyMs: Date.now() - started, sample: Array.isArray(data?.data?.results) ? data.data.results.length : 0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - started, error: err.message };
  }
}

module.exports = {
  request,
  probeHost,
  qs,
  searchSongs,
  searchAlbums,
  searchArtists,
  searchPlaylists,
  songsById,
  songsByIds,
  albumById,
  artistById,
  playlistById,
  songLyrics,
  modules,
  fetchFromHost,
};
