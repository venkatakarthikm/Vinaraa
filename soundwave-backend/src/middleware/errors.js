'use strict';

const env = require('../config/env');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/** 404 for any unmatched route — same envelope as every other error. */
function notFound(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`, 'ROUTE_NOT_FOUND'));
}

/** Converts anything thrown anywhere into the single error envelope. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  // Mongoose: bad ObjectId
  if (err.name === 'CastError') {
    error = AppError.badRequest(`Invalid value for ${err.path}`, { path: err.path, value: err.value });
  }

  // Mongoose: unique index violation
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = AppError.conflict(`${field} already exists`, 'DUPLICATE_KEY', err.keyValue);
  }

  // Mongoose: schema validation
  if (err.name === 'ValidationError') {
    const details = Object.entries(err.errors || {}).map(([path, e]) => ({ path, message: e.message }));
    error = AppError.unprocessable('Validation failed', details);
  }

  // Zod
  if (err.name === 'ZodError') {
    const details = (err.issues || []).map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }));
    error = AppError.unprocessable('Validation failed', details);
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    error = AppError.badRequest('Malformed JSON body', 'INVALID_JSON');
  }

  // Body too large
  if (err.type === 'entity.too.large') {
    error = AppError.badRequest('Payload too large', 'PAYLOAD_TOO_LARGE');
  }

  const status = error.statusCode || error.status || 500;
  const isServerError = status >= 500;

  if (isServerError) {
    logger.error('request failed', { path: req.originalUrl, method: req.method, code: error.code, err: error.message, stack: error.stack });
  }

  const body = {
    success: false,
    error: {
      code: error.code || (isServerError ? 'INTERNAL_ERROR' : 'ERROR'),
      message: isServerError && env.isProd && !error.isOperational ? 'Something went wrong on our side' : error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(env.isProd ? {} : { stack: error.stack?.split('\n').slice(0, 5) }),
    },
  };
  if (req.id) body.error.requestId = req.id;

  return res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
