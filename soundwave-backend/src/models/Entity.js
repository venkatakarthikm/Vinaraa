'use strict';

const mongoose = require('mongoose');

/**
 * Cached metadata for non-song entities: artists/singers, music directors,
 * actors (heroes), albums (movies) and languages. Powers onboarding pickers,
 * entity pages and the taste engine's labels/artwork.
 */
const entitySchema = new mongoose.Schema(
  {
    entityId: { type: String, required: true, index: true },
    type: { type: String, enum: ['artist', 'musicDirector', 'actor', 'album', 'language', 'playlist'], required: true, index: true },
    name: { type: String, required: true, index: true },
    subtitle: String,
    image: String,
    images: [{ quality: String, url: String, _id: false }],
    description: String,
    role: String,
    followerCount: { type: Number, default: 0 },
    songCount: { type: Number, default: 0 },
    language: String,
    aliases: [String],
    metrics: {
      ourListenedMs: { type: Number, default: 0 },
      ourPlays: { type: Number, default: 0 },
      ourLikes: { type: Number, default: 0 },
      popularity: { type: Number, default: 0, index: true },
    },
    raw: { type: mongoose.Schema.Types.Mixed, select: false },
    lastFetchedAt: Date,
  },
  { timestamps: true }
);

entitySchema.index({ type: 1, entityId: 1 }, { unique: true });
// Same language_override guard as Song: these documents carry a `language`
// field, which would collide with MongoDB's default text-index override field.
entitySchema.index({ type: 1, name: 'text' }, { default_language: 'none', language_override: 'textIndexLanguage' });
entitySchema.index({ type: 1, popularity: -1 });

module.exports = mongoose.model('Entity', entitySchema);
