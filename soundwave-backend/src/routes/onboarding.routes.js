'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Entity = require('../models/Entity');
const User = require('../models/User');
const catalog = require('../services/catalog');
const tasteService = require('../services/tasteService');
const playlistService = require('../services/playlistService');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/**
 * Onboarding pickers. The user asked to select favourite languages, singers and
 * directors up front — these endpoints feed those screens.
 *
 * Sources, in order: (1) OUR Entity collection (fast, already seeded by real
 * traffic), (2) the upstream search as a top-up, so the lists are never empty
 * on a fresh deployment.
 */

const LANGUAGES = [
  { code: 'hindi', label: 'Hindi', emoji: '🇮🇳' },
  { code: 'english', label: 'English', emoji: '🌍' },
  { code: 'punjabi', label: 'Punjabi', emoji: '🪘' },
  { code: 'tamil', label: 'Tamil', emoji: '🎬' },
  { code: 'telugu', label: 'Telugu', emoji: '🎥' },
  { code: 'kannada', label: 'Kannada', emoji: '🎼' },
  { code: 'malayalam', label: 'Malayalam', emoji: '🌴' },
  { code: 'marathi', label: 'Marathi', emoji: '🎭' },
  { code: 'bengali', label: 'Bengali', emoji: '🎻' },
  { code: 'gujarati', label: 'Gujarati', emoji: '🪔' },
  { code: 'bhojpuri', label: 'Bhojpuri', emoji: '🥁' },
  { code: 'urdu', label: 'Urdu', emoji: '🌙' },
  { code: 'haryanvi', label: 'Haryanvi', emoji: '🌾' },
  { code: 'rajasthani', label: 'Rajasthani', emoji: '🏜️' },
  { code: 'assamese', label: 'Assamese', emoji: '🛶' },
  { code: 'odia', label: 'Odia', emoji: '🐚' },
];

/** Curated seed names per language so the pickers are useful on day one. */
const SEED_NAMES = {
  singers: {
    hindi: ['Arijit Singh', 'Shreya Ghoshal', 'Neha Kakkar', 'Jubin Nautiyal', 'Sonu Nigam', 'Atif Aslam', 'Armaan Malik', 'Sunidhi Chauhan'],
    punjabi: ['Diljit Dosanjh', 'Sidhu Moose Wala', 'Karan Aujla', 'AP Dhillon', 'Guru Randhawa', 'Ammy Virk'],
    tamil: ['Anirudh Ravichander', 'Sid Sriram', 'S. P. Balasubrahmanyam', 'Shreya Ghoshal', 'Yuvan Shankar Raja'],
    telugu: ['S. P. Balasubrahmanyam', 'Sid Sriram', 'Armaan Malik', 'Shreya Ghoshal', 'Karthik'],
    english: ['Ed Sheeran', 'Taylor Swift', 'The Weeknd', 'Dua Lipa', 'Justin Bieber', 'Bruno Mars'],
    default: ['Arijit Singh', 'Shreya Ghoshal', 'Diljit Dosanjh', 'Neha Kakkar', 'Armaan Malik'],
  },
  directors: {
    hindi: ['Pritam', 'A. R. Rahman', 'Amit Trivedi', 'Vishal-Shekhar', 'Sachin-Jigar', 'Meet Bros', 'Tanishk Bagchi'],
    punjabi: ['B Praak', 'Jaani', 'AP Dhillon', 'Guru Randhawa'],
    tamil: ['A. R. Rahman', 'Anirudh Ravichander', 'Yuvan Shankar Raja', 'G. V. Prakash Kumar', 'Harris Jayaraj'],
    telugu: ['S. Thaman', 'Devi Sri Prasad', 'Mickey J Meyer', 'G. V. Prakash Kumar'],
    english: ['Max Martin', 'Jack Antonoff', 'Mark Ronson', 'Finneas'],
    default: ['A. R. Rahman', 'Pritam', 'Anirudh Ravichander', 'S. Thaman', 'Sachin-Jigar'],
  },
  actors: {
    hindi: ['Shah Rukh Khan', 'Ranbir Kapoor', 'Alia Bhatt', 'Salman Khan', 'Hrithik Roshan', 'Deepika Padukone', 'Ayushmann Khurrana', 'Varun Dhawan'],
    tamil: ['Vijay', 'Rajinikanth', 'Ajith Kumar', 'Suriya', 'Dhanush', 'Trisha Krishnan'],
    telugu: ['Prabhas', 'Allu Arjun', 'Mahesh Babu', 'N. T. Rama Rao Jr.', 'Ram Charan', 'Pooja Hegde'],
    punjabi: ['Diljit Dosanjh', 'Ammy Virk', 'Neeru Bajwa', 'Gippy Grewal'],
    english: ['Ryan Gosling', 'Margot Robbie', 'Timothée Chalamet', 'Zendaya', 'Tom Holland'],
    default: ['Shah Rukh Khan', 'Ranbir Kapoor', 'Alia Bhatt', 'Vijay', 'Allu Arjun', 'Prabhas'],
  },
  movies: {
    hindi: ['Brahmastra', 'Animal', 'Kabir Singh', 'Yeh Jawaani Hai Deewani', 'Aashiqui 2', 'Rockstar', 'Tamasha', 'Jawan'],
    punjabi: ['Jatt & Juliet', 'Carry On Jatta', 'Chaar Sahibzaade'],
    tamil: ['Master', 'Vikram', 'Leo', 'Ponniyin Selvan'],
    telugu: ['RRR', 'Baahubali', 'Pushpa', 'Arjun Reddy'],
    english: ['Future Nostalgia', 'After Hours', 'Divide', 'Midnights'],
    default: ['Brahmastra', 'Animal', 'Aashiqui 2', 'Rockstar', 'RRR', 'Kabir Singh'],
  },
};

const perLanguage = (map, language) => map[language] || map.default;

/** Resolves a list of names into entities, enriching them from the catalogue. */
async function resolveNames(type, names = [], language) {
  const entityType = { singers: 'artist', directors: 'musicDirector', actors: 'actor', movies: 'album' }[type];
  const docs = await Entity.find({ type: entityType, name: { $in: names } }).select('entityId name image metrics').lean();
  const byName = new Map(docs.map((d) => [d.name.toLowerCase(), d]));
  const out = names.map((name) => {
    const hit = byName.get(name.toLowerCase());
    return hit
      ? { id: hit.entityId, name: hit.name, image: hit.image, type, language, popularity: hit.metrics?.popularity || 0, source: 'catalogue' }
      : { id: null, name, image: null, type, language, popularity: 0, source: 'curated' };
  });
  return { items: out, catalogueHits: docs.length };
}

/** Popular entities already in our DB (from real listening), per type. */
async function popularFromCatalogue(type, language, limit = 24) {
  const entityType = { singers: 'artist', directors: 'musicDirector', actors: 'actor', movies: 'album' }[type];
  const filter = { type: entityType, 'metrics.popularity': { $gt: 0 } };
  if (language) filter.language = language;
  const docs = await Entity.find(filter).sort({ 'metrics.popularity': -1 }).limit(limit).lean();
  return docs.map((d) => ({ id: d.entityId, name: d.name, image: d.image, type, language: d.language, popularity: d.metrics?.popularity || 0, source: 'catalogue' }));
}

router.get('/languages', (_req, res) => ok(res, { languages: LANGUAGES }));

router.get(
  '/status',
  asyncHandler(async (req, res) =>
    ok(res, {
      completed: Boolean(req.user.onboarding.completed),
      completedAt: req.user.onboarding.completedAt,
      skipped: req.user.onboarding.skipped,
      lastStep: req.user.onboarding.lastStep,
      preferences: req.user.preferences,
      historyDepth: await tasteService.historyDepth(req.user._id),
    })
  )
);

/** Generic picker: /options?type=singers&language=hindi&q=arijit */
router.get(
  '/options',
  asyncHandler(async (req, res) => {
    const type = ['singers', 'directors', 'actors', 'movies'].includes(req.query.type) ? req.query.type : 'singers';
    const language = String(req.query.language || '').toLowerCase() || undefined;
    const q = String(req.query.q || '').trim();

    let items = await popularFromCatalogue(type, language, 30);

    if (q.length >= 2) {
      // Search first: our entity index, then the upstream as a fallback.
      const entityType = { singers: 'artist', directors: 'musicDirector', actors: 'actor', movies: 'album' }[type];
      const local = await Entity.find({ type: entityType, name: { $regex: q, $options: 'i' } }).limit(20).lean();
      items = local.map((d) => ({ id: d.entityId, name: d.name, image: d.image, type, source: 'search' }));
      if (items.length < 8) {
        try {
          const upstream = await catalog.searchGeneric(entityType === 'album' ? 'albums' : 'artists', q, { limit: 12 });
          const extra = (upstream.results || []).map((r) => ({
            id: String(r.id),
            name: catalog.decode(r.name),
            image: catalog.maxQualityImage(r.image || []),
            type,
            source: 'upstream',
          }));
          const seen = new Set(items.map((i) => i.id));
          items = items.concat(extra.filter((e) => !seen.has(e.id)));
        } catch { /* offline is fine — we already have local results */ }
      }
      return ok(res, { type, language, query: q, items: items.slice(0, 30) });
    }

    if (!items.length) {
      const resolved = await resolveNames(type, perLanguage(SEED_NAMES[type], language), language);
      items = resolved.items;
    }
    return ok(res, { type, language, items, curated: items.some((i) => i.source === 'curated') });
  })
);

/** Everything the onboarding wizard needs in ONE request (single round trip). */
router.get(
  '/bundle',
  asyncHandler(async (req, res) => {
    const language = String(req.query.language || 'hindi').toLowerCase();
    const [singers, directors, actors, movies] = await Promise.all([
      popularFromCatalogue('singers', language, 24),
      popularFromCatalogue('directors', language, 24),
      popularFromCatalogue('actors', language, 24),
      popularFromCatalogue('movies', language, 24),
    ]);
    const fill = async (type, items) => (items.length >= 12 ? items : (await resolveNames(type, perLanguage(SEED_NAMES[type], language), language)).items);
    return ok(res, {
      languages: LANGUAGES,
      language,
      steps: [
        { key: 'languages', title: 'Pick your languages', multiple: true, items: LANGUAGES, selected: req.user.preferences?.languages || [] },
        { key: 'movies', title: 'Movies you love', multiple: true, items: await fill('movies', movies) },
        { key: 'actors', title: 'Your heroes', multiple: true, items: await fill('actors', actors) },
        { key: 'singers', title: 'Singers you follow', multiple: true, items: await fill('singers', singers) },
        { key: 'directors', title: 'Music directors you trust', multiple: true, items: await fill('directors', directors) },
      ],
      order: ['languages', 'movies', 'actors', 'singers', 'directors'],
      note: 'Pick order mirrors the recommendation priority: movie → hero → language → singer → music director.',
    });
  })
);

/**
 * Completes onboarding. Seeds taste, then immediately builds the starter
 * library so the home screen is populated on first launch:
 *   • system playlists created
 *   • "Your Taste Mix" filled from the weighted recommendation engine
 */
router.post(
  '/complete',
  validate(s.onboardingCompleteSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { languages, singers, musicDirectors, actors, favouriteMovies, skipped } = req.body;

    user.preferences.languages = languages;
    user.preferences.singers = singers;
    user.preferences.musicDirectors = musicDirectors;
    user.preferences.actors = actors;
    user.preferences.favouriteMovies = favouriteMovies;
    user.onboarding = { completed: true, completedAt: new Date(), skipped: Boolean(skipped), lastStep: 99 };
    await user.save();

    await playlistService.ensureSystemPlaylists(user).catch(() => {});
    const tasteMix = await playlistService.refreshTasteMix(user, { limit: 40 }).catch(() => null);

    const profile = await tasteService.buildTasteProfile(user);
    const recommendationService = require('../services/recommendationService');
    const starters = await recommendationService.recommendForUser(user, { limit: 20, profile }).catch(() => ({ items: [] }));

    return ok(res, {
      onboarding: user.onboarding,
      preferences: user.preferences,
      taste: tasteService.toClientProfile(profile),
      starterTracks: starters.items,
      tasteMixPlaylistId: tasteMix?._id || null,
    });
  })
);

module.exports = router;
