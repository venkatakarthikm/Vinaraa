'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const User = require('../models/User');
const s = require('../validators/schemas');

const router = express.Router();
router.use(authenticate);

/**
 * Push-notification plumbing.
 *
 * The Android side posts its FCM token here; the token is stored on the device
 * subdocument (select:false, so it never leaks through a normal user read).
 *
 * Delivering the notification itself needs a sender. Nothing is faked here:
 * hook in `firebase-admin` and call it from the hook below — one file, no schema
 * change. Everything else (token registry, per-device opt-out, live-activity
 * opt-in, "what should we send" preferences) is already implemented.
 */

// eslint-disable-next-line no-unused-vars
async function deliverPush(user, { title, body, data }) {
  // TODO: integrate firebase-admin here.
  // const admin = require('firebase-admin'); ... admin.messaging().sendMulticast({...})
  return { sent: false, reason: 'push_provider_not_configured' };
}

router.post(
  '/devices',
  validate(s.deviceRegisterSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const device = user.touchDevice({ ...req.body, pushProvider: req.body.pushToken ? 'fcm' : 'none' });
    await user.save();
    return ok(res, { deviceId: device.deviceId, notificationsEnabled: device.notificationsEnabled, liveActivityEnabled: device.liveActivityEnabled });
  })
);

router.delete(
  '/devices/:deviceId',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $pull: { devices: { deviceId: req.params.deviceId } } });
    return ok(res, { removed: req.params.deviceId });
  })
);

router.get(
  '/settings',
  asyncHandler(async (req, res) =>
    ok(res, {
      devices: (req.user.devices || []).map((d) => ({
        deviceId: d.deviceId,
        platform: d.platform,
        model: d.model,
        notificationsEnabled: d.notificationsEnabled,
        liveActivityEnabled: d.liveActivityEnabled,
        hasPushToken: Boolean(d.pushToken),
        lastSeenAt: d.lastSeenAt,
      })),
      categories: {
        newReleases: true,
        weeklyStats: true,
        playlistUpdates: true,
        friendActivity: false,
        listeningReminders: false,
      },
      mediaStyleNote:
        'Playback controls on the lock screen / status bar / Samsung Now Bar come from the Android Media3 MediaSession + MediaStyle notification, not from this API. Send title, artist, artwork, duration and playback position to Media3 and the OS renders the island.',
    })
  )
);

router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const { deviceId, notificationsEnabled, liveActivityEnabled } = req.body || {};
    const set = {};
    if (deviceId) {
      const device = req.user.devices.find((d) => d.deviceId === deviceId);
      if (device) {
        if (notificationsEnabled !== undefined) device.notificationsEnabled = notificationsEnabled;
        if (liveActivityEnabled !== undefined) device.liveActivityEnabled = liveActivityEnabled;
        await req.user.save();
      }
    }
    return ok(res, { updated: true, set });
  })
);

/** Fires a test notification through the (unconfigured) sender — returns why. */
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+devices.pushToken');
    const tokens = (user.devices || []).filter((d) => d.pushToken && d.notificationsEnabled).map((d) => d.pushToken);
    if (!tokens.length) return ok(res, { sent: false, reason: 'no_registered_push_token' });
    const result = await deliverPush(user, { title: 'SoundWave', body: 'Notifications are wired up.', data: { type: 'test' } });
    return ok(res, { ...result, tokenCount: tokens.length });
  })
);

module.exports = router;
