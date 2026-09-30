'use strict';

const mongoose = require('mongoose');
const env = require('../config/env');
const { hashPassword, verifyPassword } = require('../utils/crypto');

/** Embedded device record — push tokens live with the user, no extra collection needed. */
const deviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios', 'web', 'unknown'], default: 'android' },
    model: String,
    manufacturer: String,
    osVersion: String,
    appVersion: String,
    pushToken: { type: String, select: false },
    pushProvider: { type: String, enum: ['fcm', 'none'], default: 'fcm' },
    notificationsEnabled: { type: Boolean, default: true },
    liveActivityEnabled: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    firstSeenAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const entityRefSchema = new mongoose.Schema(
  { id: String, name: String, image: String, role: String },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    handle: { type: String, lowercase: true, trim: true, sparse: true, unique: true, maxlength: 30 },
    avatarUrl: String,
    bio: { type: String, maxlength: 300 },

    country: { type: String, default: 'IN', uppercase: true, maxlength: 2 },
    locale: { type: String, default: 'en-IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', 'unspecified'], default: 'unspecified' },

    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active', index: true },
    emailVerified: { type: Boolean, default: false },

    // ── Onboarding + taste seeds (movie → hero → language → singer → director) ──
    onboarding: {
      completed: { type: Boolean, default: false },
      completedAt: Date,
      skipped: { type: Boolean, default: false },
      lastStep: { type: Number, default: 0 },
    },
    preferences: {
      languages: { type: [String], default: [] }, // ['hindi','tamil','punjabi']
      singers: { type: [entityRefSchema], default: [] },
      musicDirectors: { type: [entityRefSchema], default: [] },
      actors: { type: [entityRefSchema], default: [] }, // "heroes"
      favouriteMovies: { type: [entityRefSchema], default: [] },
      audioQuality: { type: String, enum: ['low', 'medium', 'high', 'veryhigh'], default: 'high' },
      autoplay: { type: Boolean, default: true },
      crossfadeSeconds: { type: Number, default: 0, min: 0, max: 12 },
      gapless: { type: Boolean, default: true },
      explicitContent: { type: Boolean, default: false },
      dataSaver: { type: Boolean, default: false },
      offlineOnly: { type: Boolean, default: false },
      downloadOverWifiOnly: { type: Boolean, default: true },
      themeMode: { type: String, enum: ['system', 'dark', 'light'], default: 'dark' },
    },

    // ── Denormalised lifetime counters (kept in sync by the tracking pipeline) ──
    stats: {
      totalListenedMs: { type: Number, default: 0 },
      totalPlays: { type: Number, default: 0 },
      totalSkips: { type: Number, default: 0 },
      totalSessions: { type: Number, default: 0 },
      completedPlays: { type: Number, default: 0 },
      likedSongs: { type: Number, default: 0 },
      playlistsCreated: { type: Number, default: 0 }, // drives "Playlist 1/2/3" naming
      distinctSongs: { type: Number, default: 0 },
      distinctArtists: { type: Number, default: 0 },
      streakDays: { type: Number, default: 0 },
      longestStreakDays: { type: Number, default: 0 },
      lastListenedDateKey: String,
      firstListenedAt: Date,
      lastActiveAt: Date,
    },

    devices: { type: [deviceSchema], default: [] },

    security: {
      tokenVersion: { type: Number, default: 0 },
      lastLoginAt: Date,
      lastLoginIp: String,
      loginCount: { type: Number, default: 0 },
      failedLoginAttempts: { type: Number, default: 0 },
      lockedUntil: Date,
      passwordChangedAt: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        delete ret.security?.tokenVersion;
        return ret;
      },
    },
  }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ 'stats.totalListenedMs': -1 });
userSchema.index({ 'preferences.languages': 1 });

userSchema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.security?.lockedUntil && this.security.lockedUntil > new Date());
});

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await hashPassword(plain);
  this.security = this.security || {};
  this.security.passwordChangedAt = new Date();
  return this.passwordHash;
};

userSchema.methods.verifyPassword = function verifyPasswordMethod(plain) {
  return verifyPassword(plain, this.passwordHash);
};

/** Registers/refreshes a device. Returns the device subdocument. */
userSchema.methods.touchDevice = function touchDevice(payload = {}) {
  if (!payload.deviceId) return null;
  let device = this.devices.find((d) => d.deviceId === payload.deviceId);
  if (!device) {
    device = this.devices.create({ deviceId: payload.deviceId });
    this.devices.push(device);
  }
  const fields = ['platform', 'model', 'manufacturer', 'osVersion', 'appVersion', 'pushToken', 'pushProvider', 'notificationsEnabled', 'liveActivityEnabled'];
  for (const f of fields) if (payload[f] !== undefined) device[f] = payload[f];
  device.lastSeenAt = new Date();
  // Keep the device list bounded (max 10 newest devices per account).
  if (this.devices.length > 10) {
    this.devices.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
    this.devices = this.devices.slice(0, 10);
  }
  return device;
};

userSchema.statics.maxBcryptRounds = env.BCRYPT_ROUNDS;

module.exports = mongoose.model('User', userSchema);
