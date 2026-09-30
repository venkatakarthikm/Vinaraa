'use strict';

/** Structured application error. Every failure the API returns goes through this. */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) {
    return new AppError(msg, 400, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(msg, 401, code);
  }
  static forbidden(msg = 'Not allowed', code = 'FORBIDDEN') {
    return new AppError(msg, 403, code);
  }
  static notFound(msg = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(msg, 404, code);
  }
  static conflict(msg = 'Already exists', code = 'CONFLICT', details) {
    return new AppError(msg, 409, code, details);
  }
  static unprocessable(msg = 'Validation failed', details) {
    return new AppError(msg, 422, 'VALIDATION_ERROR', details);
  }
  static tooMany(msg = 'Too many requests', details) {
    return new AppError(msg, 429, 'RATE_LIMITED', details);
  }
  static upstream(msg = 'Music service unavailable', details) {
    return new AppError(msg, 502, 'UPSTREAM_UNAVAILABLE', details);
  }
  static internal(msg = 'Internal server error', details) {
    return new AppError(msg, 500, 'INTERNAL_ERROR', details);
  }
}

module.exports = { AppError };
