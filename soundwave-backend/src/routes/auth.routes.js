'use strict';

const express = require('express');
const { asyncHandler } = require('../utils/async');
const { ok, created } = require('../utils/apiResponse');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const authService = require('../services/authService');
const tokenService = require('../services/tokenService');
const User = require('../models/User');

const router = express.Router();

router.post(
  '/register',
  authLimiter,
  validate(require('../validators/schemas').registerSchema),
  asyncHandler(async (req, res) => created(res, await authService.register(req.body)))
);

router.post(
  '/login',
  authLimiter,
  validate(require('../validators/schemas').loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login({ ...req.body, ip: req.ip, userAgent: req.headers['user-agent'] });
    return ok(res, result);
  })
);



/** Revokes every session and bumps tokenVersion (all-device logout). */
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => ok(res, await authService.logout({ userId: req.user._id, allDevices: true })))
);

router.post(
  '/forgot-password',
  authLimiter,
  validate(require('../validators/schemas').forgotPasswordSchema),
  asyncHandler(async (req, res) => ok(res, await authService.forgotPassword(req.body.email)))
);

router.post(
  '/reset-password',
  authLimiter,
  validate(require('../validators/schemas').resetPasswordSchema),
  asyncHandler(async (req, res) => ok(res, await authService.resetPassword(req.body)))
);

router.post(
  '/change-password',
  authenticate,
  validate(require('../validators/schemas').changePasswordSchema),
  asyncHandler(async (req, res) => ok(res, await authService.changePassword(req.user._id, req.body)))
);

/** Active sessions + known devices, so the app can offer "log out that phone". */
router.get(
  '/sessions',
  authenticate,
  asyncHandler(async (req, res) => ok(res, await authService.sessions(req.user._id)))
);

/** Revokes one device: refresh tokens plus the device record. */
router.delete(
  '/sessions/:deviceId',
  authenticate,
  asyncHandler(async (req, res) => {
    await tokenService.revokeDevice(req.user._id, req.params.deviceId);
    await User.updateOne({ _id: req.user._id }, { $pull: { devices: { deviceId: req.params.deviceId } } });
    return ok(res, { revoked: req.params.deviceId });
  })
);

module.exports = router;
