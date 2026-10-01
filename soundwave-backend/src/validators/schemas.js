'use strict';

const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a 24-character id');
const saavnId = z.string().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'invalid song id');

const deviceSchema = z.object({
  deviceId: z.string().min(4).max(120),
  platform: z.enum(['android', 'ios', 'web', 'unknown']).default('android'),
  model: z.string().max(80).optional(),
  manufacturer: z.string().max(80).optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(40).optional(),
  pushToken: z.string().max(500).optional(),
  pushProvider: z.enum(['fcm', 'none']).optional(),
  notificationsEnabled: z.boolean().optional(),
  liveActivityEnabled: z.boolean().optional(),
}).partial({ platform: true });

/* ── auth ────────────────────────────────────────────────────── */
const registerSchema = z.object({
  body: z.object({
    email: z.string().email().max(200),
    password: z
      .string()
      .min(8, 'must be at least 8 characters')
      .max(128)
      .regex(/[A-Za-z]/, 'must contain a letter')
      .regex(/\d/, 'must contain a number'),
    name: z.string().min(2).max(80),
    handle: z.string().min(3).max(30).optional(),
    locale: z.string().max(20).optional(),
    country: z.string().length(2).optional(),
    timezone: z.string().max(60).optional(),
    device: deviceSchema.optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(128),
    device: deviceSchema.optional(),
  }),
});



const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Za-z]/)
      .regex(/\d/),
  }),
});

const forgotPasswordSchema = z.object({ body: z.object({ email: z.string().email() }) });
const resetPasswordSchema = z.object({
  body: z.object({ email: z.string().email(), token: z.string().min(10), newPassword: z.string().min(8).max(128) }),
});

/* ── user / preferences ──────────────────────────────────────── */
const entityRef = z.object({ id: z.string().min(1).max(60), name: z.string().min(1).max(120), image: z.string().url().optional(), role: z.string().max(40).optional() });

const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(80).optional(),
      handle: z.string().min(3).max(30).optional(),
      bio: z.string().max(300).optional(),
      avatarUrl: z.string().url().max(500).optional(),
      country: z.string().length(2).optional(),
      locale: z.string().max(20).optional(),
      timezone: z.string().max(60).optional(),
      dateOfBirth: z.string().datetime().optional(),
      gender: z.enum(['male', 'female', 'other', 'unspecified']).optional(),
    })
    .strict(),
});

const preferencesSchema = z.object({
  body: z
    .object({
      languages: z.array(z.string().min(2).max(20)).max(15).optional(),
      audioQuality: z.enum(['low', 'medium', 'high', 'veryhigh']).optional(),
      autoplay: z.boolean().optional(),
      crossfadeSeconds: z.number().min(0).max(12).optional(),
      gapless: z.boolean().optional(),
      explicitContent: z.boolean().optional(),
      dataSaver: z.boolean().optional(),
      offlineOnly: z.boolean().optional(),
      downloadOverWifiOnly: z.boolean().optional(),
      themeMode: z.enum(['system', 'dark', 'light']).optional(),
      singers: z.array(entityRef).max(60).optional(),
      musicDirectors: z.array(entityRef).max(60).optional(),
      actors: z.array(entityRef).max(60).optional(),
      favouriteMovies: z.array(entityRef).max(60).optional(),
    })
    .strict(),
});

const deviceRegisterSchema = z.object({ body: deviceSchema.extend({ deviceId: z.string().min(4).max(120) }) });

/* ── onboarding ──────────────────────────────────────────────── */
const onboardingCompleteSchema = z.object({
  body: z.object({
    languages: z.array(z.string().min(2).max(20)).min(1, 'pick at least one language').max(15),
    singers: z.array(entityRef).max(60).default([]),
    musicDirectors: z.array(entityRef).max(60).default([]),
    actors: z.array(entityRef).max(60).default([]),
    favouriteMovies: z.array(entityRef).max(60).default([]),
    skipped: z.boolean().default(false),
  }),
});

/* ── music ───────────────────────────────────────────────────── */
const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(120),
    type: z.enum(['all', 'songs', 'albums', 'artists', 'playlists']).default('all'),
    page: z.coerce.number().int().min(0).max(200).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    language: z.string().max(20).optional(),
  }),
});

const paginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(0).max(500).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

const idsSchema = z.object({ query: z.object({ ids: z.string().min(3).max(2000) }) });

const streamSchema = z.object({
  query: z.object({
    quality: z.enum(['12kbps', '48kbps', '96kbps', '160kbps', '320kbps']).optional(),
    mode: z.enum(['proxy', 'redirect']).default('proxy'),
  }),
});

/* ── playlists ───────────────────────────────────────────────── */
const createPlaylistSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(1000).optional(),
    visibility: z.enum(['private', 'unlisted', 'public']).default('private'),
    trackIds: z.array(saavnId).max(500).default([]),
    coverImageUrl: z.string().url().max(500).optional(),
  }),
});

const updatePlaylistSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
      visibility: z.enum(['private', 'unlisted', 'public']).optional(),
      isCollaborative: z.boolean().optional(),
      coverImageUrl: z.string().url().max(500).optional(),
    })
    .strict(),
});

const addTracksSchema = z.object({
  body: z.object({
    songIds: z.array(saavnId).min(1).max(200),
    source: z.enum(['manual', 'recommendation', 'import', 'system']).default('manual'),
    position: z.number().int().min(0).optional(),
  }),
});

const removeTracksSchema = z.object({ body: z.object({ songIds: z.array(saavnId).min(1).max(200) }) });
const reorderSchema = z.object({ body: z.object({ from: z.number().int().min(0), to: z.number().int().min(0) }) });
const likeSchema = z.object({ body: z.object({ songId: saavnId, liked: z.boolean().optional(), sessionId: objectId.optional() }) });

/* ── tracking ────────────────────────────────────────────────── */
const startSessionSchema = z.object({
  body: z.object({
    songId: saavnId,
    deviceId: z.string().max(120).optional(),
    source: z.enum(['search', 'playlist', 'album', 'artist', 'recommendation', 'radio', 'library', 'offline', 'unknown']).default('unknown'),
    contextId: z.string().max(120).optional(),
    positionMs: z.number().int().min(0).default(0),
  }),
});

const heartbeatSchema = z.object({
  body: z.object({
    positionMs: z.number().int().min(0),
    state: z.enum(['playing', 'paused', 'buffering', 'ended']).default('playing'),
    clientTimestamp: z.number().int().optional(),
    bufferedMs: z.number().int().min(0).optional(),
  }),
});

const endSessionSchema = z.object({ body: z.object({ positionMs: z.number().int().min(0).optional(), reason: z.string().max(60).optional() }) });

const sessionEventSchema = z.object({
  body: z.object({
    eventType: z.enum(['play_start', 'play_complete', 'skip', 'pause', 'resume', 'seek', 'like', 'unlike', 'queue_add', 'playlist_add', 'repeat']),
    positionMs: z.number().int().min(0).default(0),
    songId: saavnId.optional(),
  }),
});

/** Offline-first batch sync from the Android client. */
const syncSchema = z.object({
  body: z.object({
    sessions: z
      .array(
        z.object({
          localId: z.string().max(80),
          songId: saavnId,
          deviceId: z.string().max(120).optional(),
          source: z.string().max(30).default('offline'),
          startedAt: z.string().datetime(),
          endedAt: z.string().datetime().optional(),
          listenedMs: z.number().int().min(0),
          durationMs: z.number().int().min(0).default(0),
          playCount: z.number().int().min(0).default(1),
          seekCount: z.number().int().min(0).default(0),
          completed: z.boolean().default(false),
        })
      )
      .max(200)
      .default([]),
    searchHistory: z.array(z.object({ query: z.string().max(200), at: z.string().datetime().optional() })).max(100).default([]),
  }),
});

/* ── search history ──────────────────────────────────────────── */
const searchHistorySchema = z.object({
  body: z.object({
    query: z.string().min(1).max(200),
    scope: z.enum(['all', 'songs', 'albums', 'artists', 'playlists']).default('all'),
    resultCount: z.number().int().min(0).default(0),
    clickedSongId: saavnId.optional(),
    clickedEntityId: z.string().max(60).optional(),
  }),
});

/* ── recommendations ─────────────────────────────────────────── */
const recommendSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).default(30),
    offset: z.coerce.number().int().min(0).max(500).default(0),
    language: z.string().max(20).optional(),
    strictRepeat: z.coerce.boolean().default(false),
  }),
});

const nextSchema = z.object({
  query: z.object({
    currentSongId: saavnId.optional(),
    excludeIds: z.string().max(2000).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(1),
  }),
});

/* ── stats ───────────────────────────────────────────────────── */
const rangeSchema = z.object({
  query: z.object({
    range: z.enum(['24h', '7d', '30d', '90d', '180d', 'all']).default('30d'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

const topSchema = z.object({
  query: z.object({
    type: z.enum(['songs', 'movies', 'singers', 'directors', 'actors', 'languages']).default('songs'),
    range: z.enum(['24h', '7d', '30d', '90d', '180d', 'all']).default('30d'),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

/* ── admin ───────────────────────────────────────────────────── */
const addUpstreamSchema = z.object({
  body: z.object({
    url: z.string().url().max(300),
    pathPrefix: z.string().max(40).optional(),
    label: z.string().max(80).optional(),
    notes: z.string().max(300).optional(),
    priority: z.number().int().min(0).max(100000).optional(),
    enabled: z.boolean().default(true),
  }),
});

const updateUpstreamSchema = z.object({
  body: z
    .object({
      url: z.string().url().max(300).optional(),
      pathPrefix: z.string().max(40).optional(),
      label: z.string().max(80).optional(),
      notes: z.string().max(300).optional(),
      priority: z.number().int().min(0).max(100000).optional(),
      weight: z.number().min(0).max(100).optional(),
      enabled: z.boolean().optional(),
      isFallback: z.boolean().optional(),
    })
    .strict(),
});

module.exports = {
  objectId,
  saavnId,
  deviceSchema,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateMeSchema,
  preferencesSchema,
  deviceRegisterSchema,
  onboardingCompleteSchema,
  searchSchema,
  paginationSchema,
  idsSchema,
  streamSchema,
  createPlaylistSchema,
  updatePlaylistSchema,
  addTracksSchema,
  removeTracksSchema,
  reorderSchema,
  likeSchema,
  startSessionSchema,
  heartbeatSchema,
  endSessionSchema,
  sessionEventSchema,
  syncSchema,
  searchHistorySchema,
  recommendSchema,
  nextSchema,
  rangeSchema,
  topSchema,
  addUpstreamSchema,
  updateUpstreamSchema,
};
