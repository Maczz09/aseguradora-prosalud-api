'use strict';

const { randomUUID } = require('crypto');
const asyncContext = require('../config/asyncContext');
const logger = require('../config/logger');

// Propaga el correlationId entrante de MediCitas (X-Correlation-Id) o genera
// uno nuevo si esta API se invoca de forma aislada (ej. Swagger, pruebas).
// Corre next() dentro de un AsyncLocalStorage para que el logger inyecte
// correlationId en el 100% de las líneas de log de esta petición, sin
// tener que pasarlo manualmente en cada llamada.
function correlationIdMiddleware(req, res, next) {
  const entrante = req.headers['x-correlation-id'];
  const correlationId = (typeof entrante === 'string' && entrante.trim()) || randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    // /health lo poll-ea el autoheal cada pocos segundos — excluirlo evita
    // saturar Loki/Grafana con ruido sin valor de diagnóstico.
    if (req.path === '/health' || req.path === '/metrics') return;
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    const nivel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[nivel]({ metodo: req.method, ruta: req.originalUrl, statusCode: res.statusCode, duracionMs: Math.round(duracionMs) }, 'Petición HTTP completada');
  });

  asyncContext.run(new Map([['correlationId', correlationId]]), next);
}

module.exports = { correlationIdMiddleware };
