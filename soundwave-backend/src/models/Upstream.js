'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');

/**
 * The upstream pool. This is the answer to "my worker URL will expire":
 * the JioSaavn host is DATA, not a hardcoded constant. Add/rotate/reorder
 * hosts at runtime via /api/v1/admin/upstreams — the app never notices.
 */
const upstreamSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true, trim: true },
    pathPrefix: { type: String, default: env.UPSTREAM_PATH_PREFIX }, // your worker needs '/api'
    label: { type: String, trim: true },
    notes: String,

    enabled: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 100 }, // lower = tried first
    weight: { type: Number, default: 1 },

    status: { type: String, enum: ['unknown', 'healthy', 'degraded', 'down'], default: 'unknown', index: true },
    latencyMs: { type: Number, default: 0 }, // exponential moving average
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
    consecutiveFailures: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
    lastError: String,
    lastCheckedAt: Date,
    lastOkAt: Date,
    cooldownUntil: Date,

    isFallback: { type: Boolean, default: false }, // public mirrors, used only if every own host is down
    source: { type: String, enum: ['env', 'admin'], default: 'admin' },
    addedBy: String,
  },
  { timestamps: true }
);

upstreamSchema.index({ enabled: 1, priority: 1 });
upstreamSchema.index({ status: 1, cooldownUntil: 1 });

/** Usable = enabled and not inside a failure cooldown window. */
upstreamSchema.methods.isUsable = function isUsable() {
  if (!this.enabled) return false;
  if (this.cooldownUntil && this.cooldownUntil > new Date()) return false;
  return true;
};

upstreamSchema.methods.markSuccess = function markSuccess(latency) {
  this.successCount += 1;
  this.consecutiveFailures = 0;
  this.cooldownUntil = undefined;
  this.lastOkAt = new Date();
  this.lastCheckedAt = new Date();
  this.status = 'healthy';
  const alpha = 0.3;
  this.latencyMs = this.latencyMs ? Math.round(alpha * latency + (1 - alpha) * this.latencyMs) : Math.round(latency);
  return this;
};

upstreamSchema.methods.markFailure = function markFailure(error) {
  this.failureCount += 1;
  this.consecutiveFailures += 1;
  this.lastError = String(error || '').slice(0, 400);
  this.lastCheckedAt = new Date();
  if (this.consecutiveFailures >= env.UPSTREAM_MAX_FAILURES) {
    this.status = 'down';
    this.cooldownUntil = new Date(Date.now() + env.UPSTREAM_COOLDOWN_MS);
  } else {
    this.status = 'degraded';
  }
  return this;
};

upstreamSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    url: this.url,
    pathPrefix: this.pathPrefix,
    label: this.label,
    enabled: this.enabled,
    priority: this.priority,
    weight: this.weight,
    status: this.status,
    latencyMs: this.latencyMs,
    successCount: this.successCount,
    failureCount: this.failureCount,
    consecutiveFailures: this.consecutiveFailures,
    totalRequests: this.totalRequests,
    lastError: this.lastError,
    lastCheckedAt: this.lastCheckedAt,
    lastOkAt: this.lastOkAt,
    cooldownUntil: this.cooldownUntil,
    isFallback: this.isFallback,
    source: this.source,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Upstream', upstreamSchema);
