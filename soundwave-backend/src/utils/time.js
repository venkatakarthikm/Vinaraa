'use strict';

const MS = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 };

const nowMs = () => Date.now();
const addDays = (date, days) => new Date(new Date(date).getTime() + days * MS.day);
const addMinutes = (date, minutes) => new Date(new Date(date).getTime() + minutes * MS.minute);
const daysFromNow = (days) => addDays(new Date(), days);

/** UTC day bucket, e.g. 2026-09-30 — used for streak + daily analytics rollups. */
const dateKey = (date = new Date()) => new Date(date).toISOString().slice(0, 10);
const hourOfDay = (date = new Date()) => new Date(date).getUTCHours();
const weekday = (date = new Date()) => new Date(date).getUTCDay(); // 0=Sun

/** Exponential recency decay: today = 1.0, one half-life ago = 0.5. */
function decay(ageDays, halfLifeDays = 60) {
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  if (!halfLifeDays || halfLifeDays <= 0) return 1;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

const ageInDays = (date, from = new Date()) => (new Date(from).getTime() - new Date(date).getTime()) / MS.day;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round = (v, dp = 2) => Number(Number(v || 0).toFixed(dp));
const pct = (num, den) => (den > 0 ? round((num / den) * 100, 2) : 0);

/** Human readable duration for stats payloads. */
function formatDuration(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Inclusive list of the last N UTC day keys, oldest first — drives streak/heatmap charts. */
function lastNDayKeys(n, from = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(dateKey(new Date(from.getTime() - i * MS.day)));
  return out;
}

module.exports = {
  MS,
  nowMs,
  addDays,
  addMinutes,
  daysFromNow,
  dateKey,
  hourOfDay,
  weekday,
  decay,
  ageInDays,
  clamp,
  round,
  pct,
  formatDuration,
  lastNDayKeys,
};
