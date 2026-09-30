'use strict';

const { dateKey, lastNDayKeys, round, formatDuration, MS } = require('../utils/time');
const PlayEvent = require('../models/PlayEvent');
const ListeningSession = require('../models/ListeningSession');
const DailyStat = require('../models/DailyStat');
const User = require('../models/User');
const Song = require('../models/Song');
const Playlist = require('../models/Playlist');
const catalog = require('../services/catalog');

/**
 * Analytics service. Every number below is derived from MEASURED listening
 * time (see trackingService), so skips never inflate a user's stats.
 */

const RANGES = {
  '24h': { ms: MS.day, days: 1 },
  '7d': { ms: 7 * MS.day, days: 7 },
  '30d': { ms: 30 * MS.day, days: 30 },
  '90d': { ms: 90 * MS.day, days: 90 },
  '180d': { ms: 180 * MS.day, days: 180 },
  all: { ms: null, days: null },
};

const resolveRange = (range = '30d') => {
  const key = RANGES[range] ? range : '30d';
  const cfg = RANGES[key];
  return { key, since: cfg.ms ? new Date(Date.now() - cfg.ms) : null, days: cfg.days };
};

const baseMatch = (userId, since) => ({ user: userId, listenedMs: { $gt: 0 }, ...(since ? { createdAt: { $gte: since } } : {}) });

/** Headline numbers: total time, plays, skips, averages, streak. */
async function overview(user, { range = '30d' } = {}) {
  const { key, since, days } = resolveRange(range);
  const userDoc = await User.findById(user._id).select('stats').lean();

  const [agg] = await PlayEvent.aggregate([
    { $match: baseMatch(user._id, since) },
    {
      $group: {
        _id: null,
        listenedMs: { $sum: '$listenedMs' },
        events: { $sum: 1 },
        completions: { $sum: { $cond: ['$completed', 1, 0] } },
        skips: { $sum: { $cond: ['$skipped', 1, 0] } },
        seekCount: { $sum: '$seekCount' },
        distinctSongs: { $addToSet: '$songId' },
        distinctArtists: { $addToSet: { $arrayElemAt: ['$singerIds', 0] } },
        distinctAlbums: { $addToSet: '$albumId' },
        distinctLanguages: { $addToSet: '$language' },
        days: { $addToSet: '$dayKey' },
      },
    },
  ]);

  const sessions = await ListeningSession.countDocuments({ user: user._id, ...(since ? { startedAt: { $gte: since } } : {}) });
  const listenedMs = agg?.listenedMs || 0;
  const plays = agg?.events || 0;
  const activeDays = (agg?.days || []).filter(Boolean).length;
  const periodDays = days || activeDays || 1;

  return {
    range: key,
    since,
    listeningTime: { ms: listenedMs, text: formatDuration(listenedMs), perDayMs: Math.round(listenedMs / periodDays) },
    lifetime: {
      ms: userDoc?.stats?.totalListenedMs || 0,
      text: formatDuration(userDoc?.stats?.totalListenedMs || 0),
      plays: userDoc?.stats?.totalPlays || 0,
      sessions: userDoc?.stats?.totalSessions || 0,
    },
    plays,
    completions: agg?.completions || 0,
    skips: agg?.skips || 0,
    seeks: agg?.seekCount || 0,
    completionRate: plays ? round((agg.completions / plays) * 100, 2) : 0,
    skipRate: plays ? round((agg.skips / plays) * 100, 2) : 0,
    sessions,
    averageSessionMs: sessions ? Math.round(listenedMs / sessions) : 0,
    distinct: {
      songs: (agg?.distinctSongs || []).filter(Boolean).length,
      artists: (agg?.distinctArtists || []).filter(Boolean).length,
      albums: (agg?.distinctAlbums || []).filter(Boolean).length,
      languages: (agg?.distinctLanguages || []).filter(Boolean).length,
    },
    activeDays,
    streak: { current: userDoc?.stats?.streakDays || 0, longest: userDoc?.stats?.longestStreakDays || 0 },
    library: {
      likedSongs: userDoc?.stats?.likedSongs || 0,
      playlists: await Playlist.countDocuments({ owner: user._id, deletedAt: null }),
    },
  };
}

/**
 * Top lists for any dimension: songs, movies(albums), heroes(actors), singers,
 * directors, languages. Each returns rank, label, artwork, measured time and
 * the share of total listening.
 */
async function top({ user, type = 'songs', range = '30d', limit = 20 }) {
  const { key, since } = resolveRange(range);
  const match = baseMatch(user._id, since);
  const groupSpec = {
    songs: { _id: '$songId', label: { $first: '$songName' }, image: { $first: '$songImage' }, sub: { $first: '$albumName' } },
    movies: { _id: '$albumId', label: { $first: '$albumName' } },
    singers: { _id: { $arrayElemAt: ['$singerIds', 0] } },
    directors: { _id: { $arrayElemAt: ['$directorIds', 0] } },
    actors: { _id: { $arrayElemAt: ['$actorIds', 0] } },
    languages: { _id: '$language' },
  }[type];
  if (!groupSpec) return { type, range: key, items: [], total: 0 };

  const pipeline = [
    { $match: match },
    { $group: { ...groupSpec, listenedMs: { $sum: '$listenedMs' }, plays: { $sum: 1 }, completions: { $sum: { $cond: ['$completed', 1, 0] } }, skips: { $sum: { $cond: ['$skipped', 1, 0] } } } },
    { $match: { _id: { $ne: null } } },
    { $sort: { listenedMs: -1 } },
    { $limit: Math.min(limit, 100) },
  ];

  const rows = await PlayEvent.aggregate(pipeline);
  const total = rows.reduce((s, r) => s + (r.listenedMs || 0), 0);

  // Enrich labels/artwork from our own catalogue where the event did not carry them.
  const ids = rows.map((r) => String(r._id));
  let enrich = {};
  if (type === 'singers' || type === 'directors' || type === 'actors') {
    const Entity = require('../models/Entity');
    const entityType = { singers: 'artist', directors: 'musicDirector', actors: 'actor' }[type];
    const docs = await Entity.find({ type: entityType, entityId: { $in: ids } }).select('entityId name image').lean();
    enrich = Object.fromEntries(docs.map((d) => [d.entityId, { label: d.name, image: d.image }]));
  } else if (type === 'movies') {
    const docs = await Song.find({ 'album.id': { $in: ids } }).select('album').lean();
    enrich = Object.fromEntries(docs.map((d) => [d.album.id, { label: d.album.name }]));
  } else if (type === 'languages') {
    enrich = Object.fromEntries(ids.map((id) => [id, { label: id.charAt(0).toUpperCase() + id.slice(1) }]));
  }

  return {
    type,
    range: key,
    totalMs: total,
    totalText: formatDuration(total),
    items: rows.map((r, i) => ({
      rank: i + 1,
      id: String(r._id),
      name: enrich[String(r._id)]?.label || r.label || String(r._id),
      image: enrich[String(r._id)]?.image || r.image,
      subtitle: r.sub,
      listenedMs: r.listenedMs,
      listenedText: formatDuration(r.listenedMs),
      plays: r.plays,
      completions: r.completions,
      skips: r.skips,
      sharePercent: total ? round((r.listenedMs / total) * 100, 2) : 0,
    })),
  };
}

/** Daily listening timeline (bar/line chart data) with gap-filling. */
async function timeline(user, { range = '30d' } = {}) {
  const { key, since, days } = resolveRange(range);
  const windowDays = days || 90;
  const from = since || new Date(Date.now() - windowDays * MS.day);
  const rows = await DailyStat.find({ user: user._id, dayKey: { $gte: dateKey(from) } }).sort({ dayKey: 1 }).lean();
  const byDay = new Map(rows.map((r) => [r.dayKey, r]));
  const keys = lastNDayKeys(windowDays);
  return {
    range: key,
    points: keys.map((day) => {
      const r = byDay.get(day);
      return { day, listenedMs: r?.listenedMs || 0, plays: r?.plays || 0, skips: r?.skips || 0, completions: r?.completions || 0 };
    }),
    maxMs: Math.max(0, ...keys.map((d) => byDay.get(d)?.listenedMs || 0)),
  };
}

/** 24×7 heatmap: when the user actually listens. */
async function heatmap(user, { range = '90d' } = {}) {
  const { since } = resolveRange(range);
  const rows = await PlayEvent.aggregate([
    { $match: baseMatch(user._id, since) },
    { $group: { _id: { h: '$hourOfDay', d: '$weekday' }, listenedMs: { $sum: '$listenedMs' }, plays: { $sum: 1 } } },
  ]);
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ listenedMs: 0, plays: 0 })));
  let peak = { listenedMs: 0, hour: null, weekday: null };
  for (const r of rows) {
    const d = r._id?.d ?? 0;
    const h = r._id?.h ?? 0;
    grid[d][h] = { listenedMs: r.listenedMs, plays: r.plays };
    if (r.listenedMs > peak.listenedMs) peak = { listenedMs: r.listenedMs, hour: h, weekday: d };
  }
  const hourTotals = Array.from({ length: 24 }, (_, h) => ({ hour: h, listenedMs: grid.reduce((s, row) => s + row[h].listenedMs, 0) }));
  return { grid, hourTotals, peak, weekdayLabels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
}

/** Behaviour quality: completion rate, skip rate, average seek count. */
async function listeningQuality(user, { range = '30d' } = {}) {
  const { key, since } = resolveRange(range);
  const [agg] = await ListeningSession.aggregate([
    { $match: { user: user._id, ...(since ? { startedAt: { $gte: since } } : {}) } },
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        listenedMs: { $sum: '$listenedMs' },
        wallClockMs: { $sum: '$wallClockMs' },
        completed: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        countedPlays: { $sum: { $cond: ['$isCountedPlay', 1, 0] } },
        skipped: { $sum: { $cond: ['$isSkip', 1, 0] } },
        seeks: { $sum: '$seekCount' },
        seekDistanceMs: { $sum: '$seekDistanceMs' },
        avgCompletion: { $avg: '$completionRatio' },
      },
    },
  ]);
  if (!agg) return { range: key, sessions: 0, note: 'No sessions in this range yet' };
  return {
    range: key,
    sessions: agg.sessions,
    listenedMs: agg.listenedMs,
    wallClockMs: agg.wallClockMs,
    // How much of the time the app was open was actually audio? Reveals idle/paused time.
    engagementRatio: agg.wallClockMs ? round((agg.listenedMs / agg.wallClockMs) * 100, 2) : 0,
    completed: agg.completed,
    countedPlays: agg.countedPlays,
    skipped: agg.skipped,
    completionRate: agg.sessions ? round((agg.completed / agg.sessions) * 100, 2) : 0,
    skipRate: agg.sessions ? round((agg.skipped / agg.sessions) * 100, 2) : 0,
    averageCompletionPercent: round((agg.avgCompletion || 0) * 100, 2),
    seeks: agg.seeks,
    averageSeeksPerSession: agg.sessions ? round(agg.seeks / agg.sessions, 2) : 0,
    averageSeekDistanceMs: agg.seeks ? Math.round(agg.seekDistanceMs / agg.seeks) : 0,
  };
}

/** "Year in review" style insights, written as sentences for the UI. */
async function insights(user) {
  const [ov, topSongs, topSingers, topMovies, hm, quality] = await Promise.all([
    overview(user, { range: '30d' }),
    top({ user, type: 'songs', range: '30d', limit: 3 }),
    top({ user, type: 'singers', range: '30d', limit: 3 }),
    top({ user, type: 'movies', range: '30d', limit: 3 }),
    heatmap(user, { range: '90d' }),
    listeningQuality(user, { range: '30d' }),
  ]);

  const facts = [];
  if (ov.listeningTime.ms) facts.push(`You listened for ${ov.listeningTime.text} in the last 30 days — about ${formatDuration(ov.listeningTime.perDayMs)} a day.`);
  if (topSongs.items[0]) facts.push(`Your most played song was "${topSongs.items[0].name}" (${topSongs.items[0].listenedText}, ${topSongs.items[0].sharePercent}% of your listening).`);
  if (topSingers.items[0]) facts.push(`${topSingers.items[0].name} was your top singer with ${topSingers.items[0].listenedText}.`);
  if (topMovies.items[0]) facts.push(`You kept coming back to the movie "${topMovies.items[0].name}".`);
  if (hm.peak.hour !== null) facts.push(`Your peak listening hour is ${String(hm.peak.hour).padStart(2, '0')}:00 on ${hm.weekdayLabels[hm.peak.weekday]}.`);
  if (quality.completionRate) facts.push(`You finish ${quality.completionRate}% of the tracks you start, and skip ${quality.skipRate}%.`);
  if (ov.streak.current > 1) facts.push(`You are on a ${ov.streak.current}-day listening streak. Longest: ${ov.streak.longest}.`);

  return {
    facts,
    highlights: {
      topSong: topSongs.items[0] || null,
      topSinger: topSingers.items[0] || null,
      topMovie: topMovies.items[0] || null,
      peakHour: hm.peak,
      streak: ov.streak,
    },
    quality,
  };
}

/** Recently played (distinct songs, newest first). */
async function recentlyPlayed(user, { limit = 30 } = {}) {
  const rows = await PlayEvent.aggregate([
    { $match: { user: user._id } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$songId', at: { $first: '$createdAt' }, name: { $first: '$songName' }, image: { $first: '$songImage' }, album: { $first: '$albumName' }, listenedMs: { $sum: '$listenedMs' } } },
    { $sort: { at: -1 } },
    { $limit: Math.min(limit, 100) },
  ]);
  const songs = await Song.find({ saavnId: { $in: rows.map((r) => String(r._id)) } }).lean();
  const byId = new Map(songs.map((s) => [s.saavnId, s]));
  return rows.map((r) => {
    const s = byId.get(String(r._id));
    return s
      ? { ...catalog.toClientSong(s), lastPlayedAt: r.at, listenedMs: r.listenedMs }
      : { id: String(r._id), name: r.name, image: r.image, albumName: r.album, lastPlayedAt: r.at, listenedMs: r.listenedMs, unavailable: true };
  });
}

/** Full analytics bundle for the "Stats" screen — one request, no waterfall. */
async function dashboard(user, { range = '30d' } = {}) {
  const [ov, songs, singers, movies, directors, actors, languages, tl, hm, quality, recent] = await Promise.all([
    overview(user, { range }),
    top({ user, type: 'songs', range, limit: 10 }),
    top({ user, type: 'singers', range, limit: 10 }),
    top({ user, type: 'movies', range, limit: 10 }),
    top({ user, type: 'directors', range, limit: 10 }),
    top({ user, type: 'actors', range, limit: 10 }),
    top({ user, type: 'languages', range, limit: 10 }),
    timeline(user, { range: range === '24h' ? '7d' : range }),
    heatmap(user, { range: '90d' }),
    listeningQuality(user, { range }),
    recentlyPlayed(user, { limit: 10 }),
  ]);
  // Keys match the /stats/top?type= values exactly (singers, not artists), so the
  // client can reuse one enum for both the dashboard and the drill-down call.
  return { overview: ov, top: { songs, singers, movies, directors, actors, languages }, timeline: tl, heatmap: hm, quality, recentlyPlayed: recent };
}

module.exports = { overview, top, timeline, heatmap, listeningQuality, insights, recentlyPlayed, dashboard, resolveRange, RANGES };
