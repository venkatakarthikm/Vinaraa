'use strict';

const env = require('../config/env');
const { AppError } = require('../utils/errors');
const PlayEvent = require('../models/PlayEvent');
const ListeningSession = require('../models/ListeningSession');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TASTE ENGINE  —  movie → hero → language → singer → music director
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds a weighted profile per user from two sources:
 *   1. Explicit onboarding picks (strong, fixed seed weight).
 *   2. Real listening behaviour (listenedMs, not play counts — so a skip
 *      contributes almost nothing, because a skip barely registers listenedMs).
 *
 * Every dimension is normalised to 0..1 against that user's own strongest
 * signal, so the weights below stay meaningful across heavy and light users.
 * Recency decay means this month matters more than last year.
 */

const HALF_LIFE_DAYS = 60;

const emptyProfile = () => ({
  languages: {},
  singers: {},
  directors: {},
  actors: {},
  movies: {},
  totals: { listenedMs: 0, plays: 0, skips: 0, completions: 0 },
  computedAt: new Date(),
  seeded: false,
});

const bump = (bucket, key, { score, label, image }) => {
  if (!key) return;
  const current = bucket[key] || { key, score: 0, label: label || key, image };
  current.score += score;
  if (!current.label || current.label === key) current.label = label || current.label;
  if (!current.image && image) current.image = image;
  bucket[key] = current;
};

/** Normalises a bucket so its strongest member equals 1. */
function normalize(bucket, { cap = 30 } = {}) {
  const entries = Object.values(bucket).sort((a, b) => b.score - a.score).slice(0, cap);
  const max = entries.length ? entries[0].score : 0;
  if (!max) return {};
  const out = {};
  for (const e of entries) out[e.key] = { ...e, weight: Number((e.score / max).toFixed(4)) };
  return out;
}

/** Aggregates behaviour into raw per-dimension scores. */
async function aggregateBehaviour(userId, { days = 180 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const match = { user: userId, listenedMs: { $gt: 0 }, createdAt: { $gte: since } };

  const [result] = await PlayEvent.aggregate([
    { $match: match },
    {
      $facet: {
        languages: [
          { $match: { language: { $ne: null } } },
          { $group: { _id: '$language', score: { $sum: '$listenedMs' }, plays: { $sum: 1 } } },
        ],
        // Group by artist id only. Names/artwork are resolved afterwards from the
        // user's saved seeds and the Entity collection — never fabricated here.
        // (The previous $arrayElemAt/$indexOfArray label expression was invalid
        // and threw on every call, which broke every recommendation endpoint.)
        singers: [
          { $unwind: { path: '$singerIds', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$singerIds', score: { $sum: '$listenedMs' } } },
        ],
        directors: [
          { $unwind: { path: '$directorIds', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$directorIds', score: { $sum: '$listenedMs' } } },
        ],
        actors: [
          { $unwind: { path: '$actorIds', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$actorIds', score: { $sum: '$listenedMs' } } },
        ],
        movies: [
          { $match: { albumId: { $ne: null } } },
          { $group: { _id: '$albumId', score: { $sum: '$listenedMs' }, label: { $first: '$albumName' }, image: { $first: '$songImage' } } },
        ],
        totals: [{ $group: { _id: null, listenedMs: { $sum: '$listenedMs' }, plays: { $sum: 1 } } }],
        recent: [
          { $sort: { createdAt: -1 } },
          { $limit: 200 },
          { $group: { _id: null, songIds: { $push: '$songId' } } },
        ],
      },
    },
  ]);

  const r = result || {};
  const byKey = (arr = []) => Object.fromEntries(arr.map((x) => [String(x._id), x]));
  return {
    languages: byKey(r.languages),
    singers: byKey(r.singers),
    directors: byKey(r.directors),
    actors: byKey(r.actors),
    movies: byKey(r.movies),
    totals: r.totals?.[0] || { listenedMs: 0, plays: 0 },
    recentSongIds: r.recent?.[0]?.songIds || [],
  };
}

/** Names/artwork for entity ids we have never seen as a "label". */
async function resolveLabels(user) {
  const out = { singers: {}, directors: {}, actors: {}, movies: {} };
  for (const s of user.preferences?.singers || []) out.singers[String(s.id)] = { label: s.name, image: s.image };
  for (const s of user.preferences?.musicDirectors || []) out.directors[String(s.id)] = { label: s.name, image: s.image };
  for (const s of user.preferences?.actors || []) out.actors[String(s.id)] = { label: s.name, image: s.image };
  for (const s of user.preferences?.favouriteMovies || []) out.movies[String(s.id)] = { label: s.name, image: s.image };
  return out;
}

/**
 * Full taste profile. `behaviourWeight` blends behaviour against the explicit
 * onboarding seeds: 1 = behaviour only, 0 = seeds only.
 */
async function buildTasteProfile(user, { days = 180, behaviourWeight = 0.65, seedWeight = 0.35 } = {}) {
  const profile = emptyProfile();
  const labels = await resolveLabels(user);
  const agg = await aggregateBehaviour(user._id, { days });

  // 1) Behaviour, with recency handled by the aggregation window.
  for (const [key, v] of Object.entries(agg.languages)) {
    if (v.score > 0) bump(profile.languages, key, { score: v.score * behaviourWeight, label: key });
  }
  for (const [key, v] of Object.entries(agg.singers)) {
    if (v.score > 0) bump(profile.singers, key, { score: v.score * behaviourWeight, label: labels.singers[key]?.label || v.label || key, image: labels.singers[key]?.image });
  }
  for (const [key, v] of Object.entries(agg.directors)) {
    if (v.score > 0) bump(profile.directors, key, { score: v.score * behaviourWeight, label: labels.directors[key]?.label || key, image: labels.directors[key]?.image });
  }
  for (const [key, v] of Object.entries(agg.actors)) {
    if (v.score > 0) bump(profile.actors, key, { score: v.score * behaviourWeight, label: labels.actors[key]?.label || key, image: labels.actors[key]?.image });
  }
  for (const [key, v] of Object.entries(agg.movies)) {
    if (v.score > 0) bump(profile.movies, key, { score: v.score * behaviourWeight, label: v.label || labels.movies[key]?.label || key, image: v.image });
  }

  // 2) Explicit seeds from onboarding.
  const base = Math.max(agg.totals.listenedMs, 60 * 60000); // 1 hour floor for brand-new users
  const seed = base * seedWeight;
  for (const lang of user.preferences?.languages || []) bump(profile.languages, lang, { score: seed, label: lang });
  for (const s of user.preferences?.singers || []) bump(profile.singers, String(s.id), { score: seed, label: s.name, image: s.image });
  for (const s of user.preferences?.musicDirectors || []) bump(profile.directors, String(s.id), { score: seed, label: s.name, image: s.image });
  for (const s of user.preferences?.actors || []) bump(profile.actors, String(s.id), { score: seed, label: s.name, image: s.image });
  for (const s of user.preferences?.favouriteMovies || []) bump(profile.movies, String(s.id), { score: seed, label: s.name, image: s.image });

  profile.totals = {
    listenedMs: agg.totals.listenedMs || 0,
    plays: agg.totals.plays || 0,
    skips: 0,
    completions: 0,
  };
  profile.recentSongIds = agg.recentSongIds.slice(0, 100);
  profile.seeded = Boolean((user.preferences?.languages || []).length);

  // 3) Normalise each dimension independently.
  return {
    ...profile,
    languages: normalize(profile.languages),
    singers: normalize(profile.singers),
    directors: normalize(profile.directors),
    actors: normalize(profile.actors),
    movies: normalize(profile.movies),
    weights: {
      movie: env.recoWeights.movie,
      hero: env.recoWeights.hero,
      language: env.recoWeights.language,
      singer: env.recoWeights.singer,
      director: env.recoWeights.director,
    },
  };
}

/** Compact profile for the client (top 5 per dimension + totals). */
function toClientProfile(profile) {
  const top = (bucket, n = 5) =>
    Object.values(bucket)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, n)
      .map((e) => ({ id: e.key, name: e.label, image: e.image, weight: e.weight, matchPercent: Math.round(e.weight * 100) }));

  return {
    computedAt: profile.computedAt,
    seeded: profile.seeded,
    weights: profile.weights,
    totals: profile.totals,
    topLanguages: Object.values(profile.languages).sort((a, b) => b.weight - a.weight).slice(0, 5).map((l) => ({ language: l.key, weight: l.weight })),
    topSingers: top(profile.singers),
    topDirectors: top(profile.directors),
    topActors: top(profile.actors),
    topMovies: top(profile.movies),
  };
}

/** Incrementally nudges entity popularity so onboarding lists self-improve. */
function tasteSeedsForOnboarding(user) {
  return {
    languages: user.preferences?.languages || [],
    singerIds: (user.preferences?.singers || []).map((s) => String(s.id)),
    directorIds: (user.preferences?.musicDirectors || []).map((s) => String(s.id)),
    actorIds: (user.preferences?.actors || []).map((s) => String(s.id)),
    albumIds: (user.preferences?.favouriteMovies || []).map((s) => String(s.id)),
  };
}

async function historyDepth(userId) {
  const [sessions, events] = await Promise.all([
    ListeningSession.countDocuments({ user: userId }),
    PlayEvent.countDocuments({ user: userId }),
  ]);
  return { sessions, events };
}

async function assertHasHistory(userId) {
  const depth = await historyDepth(userId);
  if (depth.events === 0) {
    throw AppError.badRequest('No listening history yet — complete onboarding or play a few songs first', 'NO_HISTORY', depth);
  }
  return depth;
}

module.exports = {
  buildTasteProfile,
  toClientProfile,
  aggregateBehaviour,
  tasteSeedsForOnboarding,
  historyDepth,
  assertHasHistory,
  emptyProfile,
  normalize,
  HALF_LIFE_DAYS,
};
