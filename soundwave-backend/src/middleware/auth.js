'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AppError } = require('../utils/errors');
const { safeEqual } = require('../utils/crypto');
const User = require('../models/User');

/** Reads a bearer token from the Authorization header. */
function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], issuer: 'soundwave' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw AppError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    throw AppError.unauthorized('Invalid access token', 'TOKEN_INVALID');
  }
}

/** Hard auth: 401 when missing/invalid. Loads the live user document onto req.user. */
async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized('Authentication required');
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user) throw AppError.unauthorized('Account no longer exists', 'USER_NOT_FOUND');
    if (user.status !== 'active') throw AppError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');
    // Token version invalidates every token issued before a logout-all / password change.
    if ((payload.tv || 0) !== (user.security?.tokenVersion || 0)) {
      throw AppError.unauthorized('Session revoked, please sign in again', 'SESSION_REVOKED');
    }
    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
}

/** Soft auth: attaches the user when a valid token is present, never fails. */
async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === 'active') {
      req.user = user;
      req.auth = payload;
    }
  } catch {
    /* ignore — treated as anonymous */
  }
  return next();
}

/** JWT-based admin guard. */
function requireAdmin(req, _res, next) {
  if (!req.user) return next(AppError.unauthorized());
  if (req.user.role !== 'admin') return next(AppError.forbidden('Admin access required'));
  return next();
}

/**
 * Ops guard for /admin/upstreams: accepts either an admin JWT or the
 * ADMIN_API_KEY header (so you can rotate a dead worker URL from curl/Postman
 * even if auth is broken).
 */
function requireAdminKey(req, _res, next) {
  const key = req.headers['x-admin-key'] || req.query.adminKey;
  if (key && safeEqual(key, env.ADMIN_API_KEY)) return next();
  return requireAdmin(req, _res, next);
}

module.exports = { authenticate, optionalAuth, requireAdmin, requireAdminKey, verifyAccessToken, extractToken };
