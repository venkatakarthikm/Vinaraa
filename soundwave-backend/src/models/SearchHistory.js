'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');

/** Search history — feeds "recent searches" and the taste engine's query signals. */
const searchHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    query: { type: String, required: true, trim: true, maxlength: 200 },
    normalizedQuery: { type: String, index: true },
    scope: { type: String, enum: ['all', 'songs', 'albums', 'artists', 'playlists'], default: 'all' },
    resultCount: { type: Number, default: 0 },
    clickedSongId: String,
    clickedEntityId: String,
    source: { type: String, default: 'app' },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

searchHistorySchema.index({ user: 1, createdAt: -1 });
searchHistorySchema.index({ user: 1, normalizedQuery: 1 }, { unique: true });
searchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: env.TTL_SEARCH_HISTORY_DAYS * 86400 });

module.exports = mongoose.model('SearchHistory', searchHistorySchema);
