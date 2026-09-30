'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');

/**
 * Second cache tier. The first tier is an in-process LRU (src/services/cache.js);
 * this one survives restarts and is shared across instances. A TTL index means
 * entries self-destruct — no Redis, no eviction job.
 */
const cacheEntrySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    kind: { type: String, index: true },
    value: { type: mongoose.Schema.Types.Mixed },
    bytes: { type: Number, default: 0 },
    hits: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

cacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
cacheEntrySchema.index({ kind: 1, updatedAt: -1 });

cacheEntrySchema.statics.sweep = function sweep() {
  return this.deleteMany({ expiresAt: { $lte: new Date() } });
};

cacheEntrySchema.statics.defaultTtl = () => env.TTL_CACHE_DAYS * 86400;

module.exports = mongoose.model('CacheEntry', cacheEntrySchema);
