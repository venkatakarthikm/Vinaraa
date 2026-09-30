'use strict';

/** Wraps async route handlers so rejections reach the central error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
