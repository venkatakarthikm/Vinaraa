'use strict';

/** Single response envelope for the whole API. The Android client parses exactly one shape. */
function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data, meta) {
  return ok(res, data, meta, 201);
}

function noContent(res) {
  return res.status(204).end();
}

function paginated(res, items, { page = 1, limit = 20, total = 0, extra } = {}) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return ok(res, items, {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages,
    hasNext: Number(page) < totalPages,
    hasPrev: Number(page) > 1,
    ...(extra || {}),
  });
}

module.exports = { ok, created, noContent, paginated };
