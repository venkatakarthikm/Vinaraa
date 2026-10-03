'use strict';

const { AppError } = require('../utils/errors');

/**
 * Zod validation middleware.
 * validate(schema)        → validates { body, query, params }
 * validate(schema, 'body') → validates one part only
 */
function validate(schema, part) {
  return (req, _res, next) => {
    try {
      if (part) {
        req[part] = schema.parse(req[part] ?? {});
        return next();
      }
      const parsed = schema.parse({ body: req.body ?? {}, query: req.query ?? {}, params: req.params ?? {} });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) req.query = { ...req.query, ...parsed.query };
      if (parsed.params) req.params = { ...req.params, ...parsed.params };
      return next();
    } catch (err) {
      if (err.name === 'ZodError') {
        const hint = req.path.startsWith('/tracking')
          ? 'Tracking payload rejected: no listening session was created for this play.'
          : undefined;
        const appErr = AppError.unprocessable(
          'Validation failed',
          (err.issues || []).map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }))
        );
        if (hint) appErr.hint = hint;
        return next(appErr);
      }
      return next(err);
    }
  };
}

module.exports = { validate };
