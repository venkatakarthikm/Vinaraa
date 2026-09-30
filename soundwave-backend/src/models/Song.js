'use strict';

const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({ quality: String, url: String }, { _id: false });
const downloadSchema = new mongoose.Schema(
  { quality: String, bitrate: Number, url: String, size: Number, format: String },
  { _id: false }
);
const artistSchema = new mongoose.Schema(
  { id: String, name: String, role: String, image: [imageSchema] },
  { _id: false }
);

/**
 * Local catalogue of every song the app has ever touched.
 * This is what makes recommendations possible even when the upstream is down,
 * and it is what the entity indexes (singer / director / actor / movie / language)
 * are queried against to build candidate pools.
 */
const songSchema = new mongoose.Schema(
  {
    saavnId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: true },
    subtitle: String,
    type: { type: String, default: 'song' },
    year: String,
    releaseDate: Date,
    durationMs: { type: Number, default: 0 },
    language: { type: String, index: true },
    label: String,
    copyright: String,
    explicitContent: { type: Boolean, default: false },
    playCount: { type: Number, default: 0 },
    hasLyrics: { type: Boolean, default: false },
    lyricsId: String,
    lyrics: String,
    saavnUrl: String,

    album: {
      id: { type: String, index: true },
      name: { type: String, index: true },
      url: String,
      year: String,
    },

    // ── Recommendation entities (movie → hero → language → singer → director) ──
    singers: [{ id: String, name: String }],
    musicDirectors: [{ id: String, name: String }],
    actors: [{ id: String, name: String }], // "hero" / starring
    lyricists: [{ id: String, name: String }],
    artists: [artistSchema],
    primaryArtistIds: [{ type: String, index: true }],

    images: { type: [imageSchema], default: [] },
    downloadUrls: { type: [downloadSchema], default: [] },

    // ── Popularity counters maintained by our own tracking ──
    metrics: {
      ourPlays: { type: Number, default: 0 },
      ourListenedMs: { type: Number, default: 0 },
      ourLikes: { type: Number, default: 0 },
      ourSkips: { type: Number, default: 0 },
      ourCompletions: { type: Number, default: 0 },
      trendingScore: { type: Number, default: 0, index: true },
      lastPlayedAt: Date,
    },

    raw: { type: mongoose.Schema.Types.Mixed, select: false },
    lastFetchedAt: Date,
    fetchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/**
 * Text index for offline/local search.
 *
 * CRITICAL: MongoDB's default text-index language_override field is literally
 * named `language`, and our documents DO carry `language: "hindi"`. A text index
 * rejects values it does not recognise as stemmers with
 * "language override unsupported: hindi" — which fails EVERY insert and every
 * upsert of a song. So we point the override at a field we never populate and
 * turn stemming off. (This bug was caught by the smoke test, not by review.)
 */
songSchema.index(
  { name: 'text', 'album.name': 'text', 'singers.name': 'text', 'musicDirectors.name': 'text', 'actors.name': 'text' },
  { default_language: 'none', language_override: 'textIndexLanguage' }
);
songSchema.index({ 'singers.id': 1, 'metrics.trendingScore': -1 });
songSchema.index({ 'musicDirectors.id': 1, 'metrics.trendingScore': -1 });
songSchema.index({ 'actors.id': 1, 'metrics.trendingScore': -1 });
songSchema.index({ language: 1, 'metrics.trendingScore': -1 });
songSchema.index({ 'album.id': 1, year: -1 });
songSchema.index({ lastFetchedAt: 1 });

songSchema.statics.findBySaavnIds = function findBySaavnIds(ids = []) {
  return this.find({ saavnId: { $in: ids } });
};

module.exports = mongoose.model('Song', songSchema);
