'use strict';

const mongoose = require('mongoose');

/**
 * A playlist track is stored as a self-contained snapshot so playlists still
 * render (title, artist, artwork, duration) even when the upstream host is
 * unavailable — important because your worker URL will rotate.
 */
const playlistTrackSchema = new mongoose.Schema(
  {
    songId: { type: String, required: true },
    name: String,
    subtitle: String,
    artistsText: String,
    image: String,
    durationMs: { type: Number, default: 0 },
    language: String,
    albumName: String,
    movieName: String,
    year: String,
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    position: { type: Number, default: 0 },
    source: { type: String, enum: ['manual', 'recommendation', 'import', 'system'], default: 'manual' },
  },
  { _id: false }
);

const playlistSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, index: true },
    description: { type: String, maxlength: 1000, default: '' },
    visibility: { type: String, enum: ['private', 'unlisted', 'public'], default: 'private', index: true },
    isSystem: { type: Boolean, default: false }, // auto-generated: Liked Songs, On Repeat, Taste Mix…
    systemKey: { type: String, index: true, sparse: true },
    isCollaborative: { type: Boolean, default: false },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    coverImageUrl: String,
    coverPalette: [String], // dominant colours for the blurred header the client renders
    tracks: { type: [playlistTrackSchema], default: [] },

    trackCount: { type: Number, default: 0 },
    totalDurationMs: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    playCount: { type: Number, default: 0 },
    lastPlayedAt: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true, transform(_d, ret) { delete ret.__v; return ret; } } }
);

playlistSchema.index({ owner: 1, deletedAt: 1, updatedAt: -1 });
playlistSchema.index({ owner: 1, name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
playlistSchema.index({ visibility: 1, followerCount: -1 });

/** Keeps denormalised counters in sync after any track mutation. */
playlistSchema.methods.recalculate = function recalculate() {
  this.trackCount = this.tracks.length;
  this.totalDurationMs = this.tracks.reduce((sum, t) => sum + (t.durationMs || 0), 0);
  this.tracks.forEach((t, i) => {
    t.position = i;
  });
  if (!this.coverImageUrl && this.tracks.length) this.coverImageUrl = this.tracks[0].image;
  return this;
};

module.exports = mongoose.model('Playlist', playlistSchema);
