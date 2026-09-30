'use strict';

const crypto = require('crypto');

/** Correlation id for every request — echoed in responses and error bodies. */
function requestContext(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('X-App', 'soundwave-backend');
  next();
}

module.exports = { requestContext };
