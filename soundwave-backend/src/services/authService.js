'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const { randomToken, sha256 } = require('../utils/crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const tokenService = require('./tokenService');
const playlistService = require('./playlistService');

const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;

const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  handle: user.handle,
  avatarUrl: user.avatarUrl,
  bio: user.bio,
  country: user.country,
  locale: user.locale,
  timezone: user.timezone,
  role: user.role,
  status: user.status,
  emailVerified: user.emailVerified,
  onboarding: user.onboarding,
  preferences: user.preferences,
  stats: user.stats,
  devices: (user.devices || []).map((d) => ({
    id: d._id,
    deviceId: d.deviceId,
    platform: d.platform,
    model: d.model,
    manufacturer: d.manufacturer,
    osVersion: d.osVersion,
    appVersion: d.appVersion,
    notificationsEnabled: d.notificationsEnabled,
    liveActivityEnabled: d.liveActivityEnabled,
    lastSeenAt: d.lastSeenAt,
    firstSeenAt: d.firstSeenAt,
  })),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

async function register({ email, password, name, handle, locale, country, timezone, device }) {
  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');

  let finalHandle = handle ? String(handle).toLowerCase().replace(/[^a-z0-9_]/g, '') : undefined;
  if (finalHandle) {
    const taken = await User.findOne({ handle: finalHandle });
    if (taken) throw AppError.conflict('That handle is taken', 'HANDLE_TAKEN');
  }

  const user = new User({ email: String(email).toLowerCase(), name, handle: finalHandle, locale, country, timezone });
  await user.setPassword(password);
  if (device?.deviceId) user.touchDevice(device);
  await user.save();

  // Every account starts with its system playlists so the library is never empty.
  await playlistService.ensureSystemPlaylists(user).catch((err) => logger.warn('system playlist bootstrap failed', { err: err.message }));

  const tokens = await tokenService.issueTokenPair(user, {
    deviceId: device?.deviceId,
    ip: undefined,
    userAgent: undefined,
  });
  logger.info('user registered', { userId: String(user._id) });
  return { user: publicUser(user), tokens };
}

async function login({ email, password, device, ip, userAgent }) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user) throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (user.status === 'suspended') throw AppError.forbidden('This account is suspended', 'ACCOUNT_SUSPENDED');
  if (user.isLocked) {
    throw AppError.forbidden(
      `Too many failed attempts. Try again after ${user.security.lockedUntil.toISOString()}`,
      'ACCOUNT_LOCKED'
    );
  }

  const valid = await user.verifyPassword(password);
  if (!valid) {
    user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
    if (user.security.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.security.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
      user.security.failedLoginAttempts = 0;
    }
    await user.save();
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  user.security.failedLoginAttempts = 0;
  user.security.lockedUntil = undefined;
  user.security.lastLoginAt = new Date();
  user.security.lastLoginIp = ip;
  user.security.loginCount = (user.security.loginCount || 0) + 1;
  user.stats.lastActiveAt = new Date();
  if (device?.deviceId) user.touchDevice(device);
  await user.save();

  await playlistService.ensureSystemPlaylists(user).catch(() => {});

  const tokens = await tokenService.issueTokenPair(user, { deviceId: device?.deviceId, ip, userAgent });
  return { user: publicUser(user), tokens };
}

async function refresh({ refreshToken, ip, userAgent, deviceId }) {
  const rotated = await tokenService.rotateRefreshToken(refreshToken, { ip, userAgent, deviceId });
  const user = await User.findById(rotated.userId);
  if (!user) throw AppError.unauthorized('Account no longer exists', 'USER_NOT_FOUND');
  if (user.status !== 'active') throw AppError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');
  if (deviceId) {
    user.touchDevice({ deviceId });
    await user.save();
  }
  return {
    user: publicUser(user),
    tokens: {
      accessToken: tokenService.signAccessToken(user),
      refreshToken: rotated.raw,
      tokenType: 'Bearer',
      expiresIn: Math.floor(tokenService.accessTokenExpiresInMs() / 1000),
      refreshExpiresAt: rotated.doc.expiresAt,
    },
  };
}

async function logout({ userId, refreshToken, allDevices = false }) {
  if (allDevices) {
    await tokenService.revokeAllForUser(userId, 'logout_all');
    await User.updateOne({ _id: userId }, { $inc: { 'security.tokenVersion': 1 } });
    return { revoked: 'all' };
  }
  await tokenService.revokeRefreshToken(refreshToken, 'logout');
  return { revoked: 'one' };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw AppError.notFound('User not found');
  const okPw = await user.verifyPassword(currentPassword);
  if (!okPw) throw AppError.unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');
  await user.setPassword(newPassword);
  user.security.tokenVersion = (user.security.tokenVersion || 0) + 1; // kill every existing access token
  await user.save();
  await tokenService.revokeAllForUser(user._id, 'password_changed');
  return { ok: true };
}

/** Generates a reset token. Emailed in production; returned only outside production. */
async function forgotPassword(email) {
  const user = await User.findOne({ email: String(email).toLowerCase() });
  // Always answer the same way — no account enumeration.
  if (!user) return { sent: true };
  const raw = randomToken(32);
  user.security = user.security || {};
  user.security.resetTokenHash = sha256(raw);
  user.security.resetTokenExpiresAt = new Date(Date.now() + 30 * 60000);
  await user.save();
  logger.info('password reset requested', { userId: String(user._id) });
  return { sent: true, ...(env.isProd ? {} : { devResetToken: raw }) };
}

async function resetPassword({ email, token, newPassword }) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+security.resetTokenHash');
  if (!user?.security?.resetTokenHash) throw AppError.badRequest('Reset token is invalid or expired', 'RESET_INVALID');
  if (user.security.resetTokenExpiresAt < new Date()) throw AppError.badRequest('Reset token has expired', 'RESET_EXPIRED');
  if (sha256(token) !== user.security.resetTokenHash) throw AppError.badRequest('Reset token is invalid or expired', 'RESET_INVALID');
  await user.setPassword(newPassword);
  user.security.resetTokenHash = undefined;
  user.security.resetTokenExpiresAt = undefined;
  user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
  await user.save();
  await tokenService.revokeAllForUser(user._id, 'password_reset');
  return { ok: true };
}

async function sessions(userId) {
  const [tokens, user] = await Promise.all([tokenService.listActiveSessions(userId), User.findById(userId).lean()]);
  return {
    activeSessions: tokens.map((t) => ({
      id: t._id,
      deviceId: t.deviceId,
      ip: t.ip,
      userAgent: t.userAgent,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    })),
    devices: (user?.devices || []).map((d) => ({
      deviceId: d.deviceId,
      platform: d.platform,
      model: d.model,
      lastSeenAt: d.lastSeenAt,
      notificationsEnabled: d.notificationsEnabled,
      liveActivityEnabled: d.liveActivityEnabled,
    })),
    loginCount: user?.security?.loginCount || 0,
    lastLoginAt: user?.security?.lastLoginAt,
  };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
  sessions,
  publicUser,
  MAX_FAILED_LOGINS,
};
