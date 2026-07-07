'use strict';

const { httpRequestDuration, httpRequestTotal, httpRequestErrors } = require('../config/metrics');

function normalizeRoute(req) {
  if (req.route) {
    const baseUrl = req.baseUrl || '';
    return baseUrl + req.route.path;
  }
  return req.path.replace(/\/[0-9a-f-]{20,}/gi, '/:id').replace(/\/\d+/g, '/:id');
}

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = { method: req.method, route: normalizeRoute(req), status_code: res.statusCode };

    httpRequestDuration.observe(labels, durationSec);
    httpRequestTotal.inc(labels);
    if (res.statusCode >= 400) httpRequestErrors.inc(labels);
  });

  next();
}

module.exports = { metricsMiddleware };
