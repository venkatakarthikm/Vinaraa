'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const cache = require('./cache');
const Song = require('../models/Song');
const catalog = require('./catalog');
const taste = require('./tasteService');

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RECOMMENDATION ENGINE — movie → hero → language → singer → music director
 * ─────────────────────────────────────────────────────────────────────────────
 * No "sad/love/romance" mood tags: the upstream does not expose them, and the
 * user explicitly asked for the entity graph instead. A song's score is:
 *
 *   score =  W_movie   * match(movie / album)      ← strongest signal
 *          + W_hero    * match(actor, "starring")
 *          + W_lang    * match(language)
 *          + W_singer  * match(primary artists)
 *          + W_director* match(music director)
 *          + popularityBoost − repetitionPenalty
 *
 * Every result carries a full `explain` block so the UI can show
 * "92% match · movie 100% · hero 80% · singer 60%" exactly as requested.
 */

const WEIGHTS = env.recoWeights;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Best (highest) weight among a set of entity ids for one dimension. */
function bestWeight(bucket, ids = []) {
  let best = 0;
  let winner = null;
  for (const id of ids) {
    const entry = bucket[String(id)];
    if (entry && entry.weight > best) {
      best = entry.weight;
      winner = entry;
    }
  }
  return { weight: best, entry: winner };
}

function popularityBoost(song) {
  const m = song.metrics || {};
  const plays = m.ourPlays || 0;
  const upstream = song.playCount || 0;
  // Log-scaled so a 200M-play track does not drown a great 5k-play match.
  const our = plays > 0 ? Math.log10(1 + plays) / 3 : 0;
  const global = upstream > 0 ? Math.log10(1 + upstream) / 12 : 0;
  return clamp01(our * 0.7 + global * 0.3) * 0.08;
}

/** Songs heard very recently are pushed down but not banned (unless strict). */
function repetitionPenalty(song, recentSet, { strict = false } = {}) {
  if (!recentSet || !recentSet.size) return 0;
  if (!recentSet.has(song.saavnId)) return 0;
  return strict ? 1 : 0.25;
}

/** Scores one song against a taste profile. Returns score 0..1 + explanation. */
function scoreSong(song, profile, { recentSet, strictRepeat = false, boosts = {} } = {}) {
  const movie = bestWeight(profile.movies, [song.album?.id].filter(Boolean));
  const hero = bestWeight(profile.actors, (song.actors || []).map((a) => a.id));
  const lang = profile.languages[song.language] ? { weight: profile.languages[song.language].weight, entry: profile.languages[song.language] } : { weight: 0, entry: null };
  const singer = bestWeight(profile.singers, (song.singers || []).map((s) => s.id));
  const director = bestWeight(profile.directors, (song.musicDirectors || []).map((d) => d.id));

  // Genre-agnostic "is this even the right kind of content for me" prior.
  const affinity =
    WEIGHTS.movie * movie.weight +
    WEIGHTS.hero * hero.weight +
    WEIGHTS.language * lang.weight +
    WEIGHTS.singer * singer.weight +
    WEIGHTS.director * director.weight;

  const boost = popularityBoost(song) + (boosts[song.saavnId] || 0);
  const penalty = repetitionPenalty(song, recentSet, { strict: strictRepeat });
  const raw = clamp01(affinity + boost - penalty);

  const explain = {
    movie: Math.round(movie.weight * 100),
    hero: Math.round(hero.weight * 100),
    language: Math.round(lang.weight * 100),
    singer: Math.round(singer.weight * 100),
    director: Math.round(director.weight * 100),
    popularity: Math.round(boost * 100),
    repetitionPenalty: Math.round(penalty * 100),
    total: Math.round(raw * 100),
    matched: {
      movie: movie.entry?.label,
      hero: hero.entry?.label,
      singer: singer.entry?.label,
      director: director.entry?.label,
      language: lang.entry ? lang.entry.key : undefined,
    },
  };

  return { score: raw, explain };
}

/** Top N keys of a normalised bucket, by weight. */
const topKeys = (bucket, n) =>
  Object.values(bucket)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, n)
    .map((e) => e.key);

/**
 * Candidate generation. Prefers OUR catalogue (fast, offline-capable) and only
 * reaches for the upstream when the local pool is too thin — which is the
 * common case for a brand-new user with no history.
 */
async function generateCandidates(profile, { limit = 200, extraLanguages = [] } = {}) {
  const languages = [...new Set([...topKeys(profile.languages, 4), ...extraLanguages])];
  const singerIds = topKeys(profile.singers, 8);
  const directorIds = topKeys(profile.directors, 6);
  const actorIds = topKeys(profile.actors, 6);
  const albumIds = topKeys(profile.movies, 6);

  let candidates = await catalog.localCandidates({ language: languages[0], singerIds, directorIds, actorIds, albumIds, limit });

  // Top up with the other preferred languages.
  if (candidates.length < limit && languages.length > 1) {
    const more = await catalog.localCandidates({ language: { $in: languages.slice(1) }, limit: limit - candidates.length });
    const seen = new Set(candidates.map((c) => c.saavnId));
    candidates = candidates.concat(more.filter((m) => !seen.has(m.saavnId)));
  }

  // Cold start / thin catalogue → pull from the upstream by the user's top names.
  if (candidates.length < 40) {
    const seedQueries = [
      ...topKeys(profile.movies, 2).map((id) => profile.movies[id]?.label),
      ...topKeys(profile.singers, 3).map((id) => profile.singers[id]?.label),
      ...topKeys(profile.directors, 2).map((id) => profile.directors[id]?.label),
      ...topKeys(profile.actors, 2).map((id) => profile.actors[id]?.label),
      ...languages.slice(0, 2).map((l) => `${l} hits`),
    ].filter(Boolean);

    for (const q of seedQueries.slice(0, 6)) {
      if (candidates.length >= limit) break;
      try {
        const res = await catalog.searchSongs(q, { limit: 20 });
        const fresh = await Song.find({ saavnId: { $in: (res.results || []).map((r) => String(r.id)).filter(Boolean) } }).lean();
        const seen = new Set(candidates.map((c) => c.saavnId));
        candidates = candidates.concat(fresh.filter((f) => !seen.has(f.saavnId)));
      } catch (err) {
        logger.debug('candidate top-up search failed', { q, err: err.message });
      }
    }
  }

  // Last resort: whatever the catalogue has (works fully offline).
  if (candidates.length < 20) {
    const trending = await catalog.trendingFromCatalogue({ language: languages[0], limit });
    const seen = new Set(candidates.map((c) => c.saavnId));
    candidates = candidates.concat(trending.filter((t) => !seen.has(t.saavnId)));
  }

  return candidates;
}

/** Main entry point: ranked, explained recommendations for a user. */
async function recommendForUser(user, { limit = 30, offset = 0, language, strictRepeat = false, profile: providedProfile } = {}) {
  const profile = providedProfile || (await taste.buildTasteProfile(user));
  const recentSet = new Set((profile.recentSongIds || []).slice(0, 60));

  let candidates = await generateCandidates(profile, { limit: 300, extraLanguages: language ? [language] : [] });
  if (language) candidates = candidates.filter((c) => c.language === language);

  const scored = candidates
    .map((song) => {
      const { score, explain } = scoreSong(song, profile, { recentSet, strictRepeat });
      return { song, score, explain };
    })
    .sort((a, b) => b.score - a.score);

  const page = scored.slice(offset, offset + limit);
  return {
    profile: {
      weights: profile.weights,
      seeded: profile.seeded,
      topSingers: topKeys(profile.singers, 5),
      topDirectors: topKeys(profile.directors, 5),
      topActors: topKeys(profile.actors, 5),
      topLanguages: topKeys(profile.languages, 5),
    },
    poolSize: candidates.length,
    items: page.map(({ song, score, explain }) => ({
      ...catalog.toClientSong(song),
      matchPercent: explain.total,
      explain,
      reason: buildReason(explain),
    })),
  };
}

/** Human-readable "why this song" line for the UI. */
function buildReason(explain) {
  const parts = [];
  if (explain.matched.movie && explain.movie >= 60) parts.push(`from ${explain.matched.movie}`);
  if (explain.matched.hero && explain.hero >= 60) parts.push(`starring ${explain.matched.hero}`);
  if (explain.matched.singer && explain.singer >= 60) parts.push(`sung by ${explain.matched.singer}`);
  if (explain.matched.director && explain.director >= 60) parts.push(`music by ${explain.matched.director}`);
  if (parts.length) return `Because you like ${parts.slice(0, 2).join(' and ')}`;
  if (explain.matched.language) return `Popular in ${explain.matched.language}`;
  return 'Picked for you';
}

/**
 * "Next song" for the player. Similarity is entity-first and honours the
 * movie → hero → language → singer → director priority.
 */
async function nextSong(user, { currentSongId, excludeIds = [], limit = 1, source } = {}) {
  const profile = await taste.buildTasteProfile(user);
  const exclude = new Set([...excludeIds, ...(currentSongId ? [currentSongId] : [])].map(String));

  let current = null;
  if (currentSongId) current = await Song.findOne({ saavnId: currentSongId }).lean();

  // 1) Same movie / album first — the strongest continuity signal.
  if (current?.album?.id) {
    const sameMovie = await Song.find({ 'album.id': current.album.id, saavnId: { $nin: [...exclude] } }).limit(limit).lean();
    if (sameMovie.length >= limit) return finalizeNext(sameMovie, profile, 'same_movie');
  }

  // 2) Then the same hero / singer / director cluster.
  const clusterFilter = [];
  if (current?.actors?.length) clusterFilter.push({ 'actors.id': { $in: current.actors.map((a) => a.id) } });
  if (current?.singers?.length) clusterFilter.push({ 'singers.id': { $in: current.singers.map((s) => s.id) } });
  if (current?.musicDirectors?.length) clusterFilter.push({ 'musicDirectors.id': { $in: current.musicDirectors.map((d) => d.id) } });
  if (clusterFilter.length) {
    const clustered = await Song.find({ $or: clusterFilter, saavnId: { $nin: [...exclude] } }).limit(20).lean();
    if (clustered.length) {
      const ranked = clustered
        .map((s) => ({ song: s, ...scoreSong(s, profile, { recentSet: new Set(exclude) }) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return finalizeNext(ranked.map((r) => ({ ...r.song, _score: r.score, _explain: r.explain })), profile, 'same_cluster');
    }
  }

  // 3) Fall back to the personal ranking.
  const recs = await recommendForUser(user, { limit: limit + exclude.size, strictRepeat: true, profile });
  const picked = recs.items.filter((i) => !exclude.has(i.id)).slice(0, limit);
  return { source: source || 'personal_ranking', items: picked, profile: recs.profile };
}

function finalizeNext(songs, profile, source) {
  return {
    source,
    items: songs.map((s) => {
      const { score, explain } = s._score !== undefined ? { score: s._score, explain: s._explain } : scoreSong(s, profile, {});
      return { ...catalog.toClientSong(s), matchPercent: explain.total, explain, reason: buildReason(explain) };
    }),
    profile: { weights: profile.weights, seeded: profile.seeded },
  };
}

/**
 * Home feed: several explained rails rather than one flat list, which is what
 * makes the app feel "Spotify level" while staying explainable.
 */
async function buildFeed(user, { limit = 20 } = {}) {
  const profile = await taste.buildTasteProfile(user);
  const [personal, trending] = await Promise.all([
    recommendForUser(user, { limit, profile }),
    catalog.trendingFromCatalogue({ language: topKeys(profile.languages, 1)[0], limit }),
  ]);

  const rails = [];
  rails.push({
    key: 'made_for_you',
    title: 'Made for you',
    subtitle: 'Weighted on your movies, heroes, languages, singers and directors',
    items: personal.items.slice(0, limit),
  });

  const topLang = topKeys(profile.languages, 1)[0];
  if (topLang) {
    rails.push({
      key: 'language_pick',
      title: `Because you listen to ${topLang}`,
      subtitle: `Your top language · ${Math.round((profile.languages[topLang]?.weight || 0) * 100)}% affinity`,
      items: personal.items.filter((i) => i.language === topLang).slice(0, limit),
    });
  }

  const topMovie = topKeys(profile.movies, 1)[0];
  if (topMovie) {
    const movieSongs = await Song.find({ 'album.id': topMovie }).sort({ playCount: -1 }).limit(limit).lean();
    rails.push({
      key: 'movie_pick',
      title: `More from ${profile.movies[topMovie]?.label || 'your favourite movie'}`,
      subtitle: 'Your strongest movie signal',
      items: movieSongs.map((s) => ({ ...catalog.toClientSong(s), matchPercent: scoreSong(s, profile, {}).explain.total })),
    });
  }

  const topSinger = topKeys(profile.singers, 1)[0];
  if (topSinger) {
    const singerSongs = await Song.find({ 'singers.id': topSinger }).sort({ 'metrics.trendingScore': -1, playCount: -1 }).limit(limit).lean();
    rails.push({
      key: 'singer_pick',
      title: `Best of ${profile.singers[topSinger]?.label || 'your favourite singer'}`,
      subtitle: 'Your top singer',
      items: singerSongs.map((s) => ({ ...catalog.toClientSong(s), matchPercent: scoreSong(s, profile, {}).explain.total })),
    });
  }

  if (trending.length) {
    rails.push({ key: 'trending', title: 'Trending in your languages', subtitle: 'Fresh from the catalogue', items: trending.map((s) => catalog.toClientSong(s)) });
  }

  return { generatedAt: new Date(), profile: personal.profile, rails: rails.filter((r) => r.items.length) };
}

module.exports = {
  scoreSong,
  recommendForUser,
  nextSong,
  buildFeed,
  generateCandidates,
  buildReason,
  topKeys,
};
