'use strict';

const express = require('express');
const health = require('./health.routes');
const auth = require('./auth.routes');
const users = require('./user.routes');
const onboarding = require('./onboarding.routes');
const music = require('./music.routes');
const playlists = require('./playlist.routes');
const tracking = require('./tracking.routes');
const recommendations = require('./recommendation.routes');
const stats = require('./stats.routes');
const notifications = require('./notification.routes');
const admin = require('./admin.routes');
const { ok } = require('../utils/apiResponse');

const router = express.Router();

/** API index — a self-documenting map of every mounted surface. */
router.get('/', (_req, res) =>
  ok(res, {
    name: 'SoundWave API',
    version: require('../../package.json').version,
    baseUrl: '/api/v1',
    endpoints: {
      health: ['GET /api/v1/health', 'GET /api/v1/health/ready', 'GET /api/v1/health/diagnostics', 'GET /api/v1/health/upstream/search'],
      auth: [
        'POST /api/v1/auth/register',
        'POST /api/v1/auth/login',

        'POST /api/v1/auth/logout',
        'POST /api/v1/auth/logout-all',
        'POST /api/v1/auth/forgot-password',
        'POST /api/v1/auth/reset-password',
        'POST /api/v1/auth/change-password',
        'GET  /api/v1/auth/sessions',
        'DELETE /api/v1/auth/sessions/:deviceId',
      ],
      users: [
        'GET  /api/v1/users/me',
        'PATCH /api/v1/users/me',
        'PATCH /api/v1/users/me/preferences',
        'PUT  /api/v1/users/me/taste-seeds',
        'POST /api/v1/users/me/devices',
        'GET  /api/v1/users/me/search-history',
        'POST /api/v1/users/me/search-history',
        'DELETE /api/v1/users/me/search-history',
        'GET  /api/v1/users/me/export',
        'DELETE /api/v1/users/me',
      ],
      onboarding: ['GET /api/v1/onboarding/bundle', 'GET /api/v1/onboarding/options', 'GET /api/v1/onboarding/languages', 'GET /api/v1/onboarding/status', 'POST /api/v1/onboarding/complete'],
      music: [
        'GET /api/v1/music/search?q=&type=all|songs|albums|artists|playlists',
        'GET /api/v1/music/search/suggestions?q=',
        'GET /api/v1/music/songs/:id',
        'GET /api/v1/music/songs?ids=a,b,c',
        'GET /api/v1/music/songs/:id/lyrics',
        'GET /api/v1/music/songs/:id/similar',
        'GET /api/v1/music/albums/:id',
        'GET /api/v1/music/artists/:id',
        'GET /api/v1/music/editorial/playlists/:id',
        'GET /api/v1/music/modules',
        'GET /api/v1/music/trending',
        'GET /api/v1/music/languages',
        'GET /api/v1/music/stream/:id?mode=proxy|redirect&quality=320kbps',
      ],
      playlists: [
        'GET  /api/v1/playlists',
        'POST /api/v1/playlists',
        'GET  /api/v1/playlists/:id',
        'PATCH /api/v1/playlists/:id',
        'DELETE /api/v1/playlists/:id',
        'POST /api/v1/playlists/:id/tracks',
        'DELETE /api/v1/playlists/:id/tracks',
        'PATCH /api/v1/playlists/:id/reorder',
        'POST /api/v1/playlists/:id/duplicate',
        'POST /api/v1/playlists/save-song',
        'GET  /api/v1/playlists/name-suggestion',
        'GET  /api/v1/playlists/liked',
        'POST /api/v1/playlists/liked',
        'GET  /api/v1/playlists/system',
        'POST /api/v1/playlists/system/taste-mix/refresh',
        'POST /api/v1/playlists/system/on-repeat/refresh',
      ],
      tracking: [
        'POST /api/v1/tracking/sessions',
        'POST /api/v1/tracking/sessions/:id/heartbeat',
        'POST /api/v1/tracking/sessions/:id/end',
        'POST /api/v1/tracking/sessions/:id/events',
        'POST /api/v1/tracking/sync',
        'GET  /api/v1/tracking/sessions/active',
        'GET  /api/v1/tracking/sessions/:id',
      ],
      recommendations: [
        'GET /api/v1/recommendations/feed',
        'GET /api/v1/recommendations/for-you',
        'GET /api/v1/recommendations/next?currentSongId=',
        'GET /api/v1/recommendations/radio?songId=|entityId=&entityType=',
        'GET /api/v1/recommendations/entity/:type/:id',
        'GET /api/v1/recommendations/taste-profile',
      ],
      stats: [
        'GET  /api/v1/stats/dashboard',
        'GET  /api/v1/stats/overview',
        'GET  /api/v1/stats/top?type=songs|movies|singers|directors|actors|languages',
        'GET  /api/v1/stats/timeline',
        'GET  /api/v1/stats/heatmap',
        'GET  /api/v1/stats/quality',
        'GET  /api/v1/stats/insights',
        'GET  /api/v1/stats/recently-played',
        'GET  /api/v1/stats/history',
        'GET  /api/v1/stats/history/sessions',
        'POST /api/v1/stats/verify-tracking',
      ],
      notifications: ['POST /api/v1/notifications/devices', 'DELETE /api/v1/notifications/devices/:deviceId', 'GET /api/v1/notifications/settings', 'PATCH /api/v1/notifications/settings', 'POST /api/v1/notifications/test'],
      admin: [
        'GET    /api/v1/admin/upstreams            (x-admin-key)',
        'POST   /api/v1/admin/upstreams',
        'PATCH  /api/v1/admin/upstreams/:id',
        'DELETE /api/v1/admin/upstreams/:id',
        'POST   /api/v1/admin/upstreams/health-check',
        'POST   /api/v1/admin/upstreams/optimize',
        'GET    /api/v1/admin/stats',
        'GET    /api/v1/admin/users',
        'POST   /api/v1/admin/maintenance/ensure-indexes',
        'POST   /api/v1/admin/maintenance/sweep-cache',
        'POST   /api/v1/admin/maintenance/reap-stale-sessions',
        'POST   /api/v1/admin/maintenance/refresh-catalogue',
        'POST   /api/v1/admin/maintenance/rebuild-system-playlists',
        'POST   /api/v1/admin/maintenance/recompute-trending',
      ],
    },
  })
);

router.use('/health', health);
router.use('/auth', auth);
router.use('/users', users);
router.use('/onboarding', onboarding);
router.use('/music', music);
router.use('/playlists', playlists);
router.use('/tracking', tracking);
router.use('/recommendations', recommendations);
router.use('/stats', stats);
router.use('/notifications', notifications);
router.use('/admin', admin);

module.exports = router;
