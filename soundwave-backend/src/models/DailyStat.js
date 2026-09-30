'use strict';

const mongoose = require('mongoose');

/**
 * Per-user, per-day pre-aggregated rollup. This is what keeps the analytics
 * endpoints instant even after the raw events expire, and it is the source for
 * streaks, the listening heatmap and the "your year in music" style pages.
 *
 * `hours` is a Map so $inc { 'hours.17': 1 } creates/updates the bucket in one
 * atomic upsert (no read-modify-write, no race).
 */
const dailyStatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayKey: { type: String, required: true }, // YYYY-MM-DD (UTC)
    listenedMs: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
    skips: { type: Number, default: 0 },
    completions: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    seekCount: { type: Number, default: 0 },
    hours: { type: Map, of: Number, default: {} },
    languages: { type: Map, of: Number, default: {} }, // listenedMs per language
  },
  { timestamps: true, versionKey: false }
);

dailyStatSchema.index({ user: 1, dayKey: 1 }, { unique: true });
dailyStatSchema.index({ user: 1, dayKey: -1 });

module.exports = mongoose.model('DailyStat', dailyStatSchema);
