'use strict';

const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const httpRequestErrors = new client.Counter({
  name: 'http_request_errors_total',
  help: 'Total de errores HTTP (4xx y 5xx)',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// --- Métricas de negocio ---

const validacionesCoberturaCounter = new client.Counter({
  name: 'aseguradora_validaciones_cobertura_total',
  help: 'Total de validaciones de cobertura consultadas por MediCitas',
  labelNames: ['resultado'], // aprobada | rechazada
  registers: [register],
});

const aseguradosRegistradosCounter = new client.Counter({
  name: 'aseguradora_asegurados_registrados_total',
  help: 'Total de asegurados registrados',
  registers: [register],
});

// --- Métricas SRE (Outbox de webhooks) ---

const webhooksSalientesPendientesGauge = new client.Gauge({
  name: 'webhooks_salientes_pendientes',
  help: 'Cantidad de webhooks salientes en estado PENDIENTE (outbox local hacia MediCitas)',
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpRequestErrors,
  validacionesCoberturaCounter,
  aseguradosRegistradosCounter,
  webhooksSalientesPendientesGauge,
};

// Inicializa las series en 0 para que Grafana no muestre "No data" antes del primer evento.
validacionesCoberturaCounter.inc({ resultado: 'aprobada' }, 0);
validacionesCoberturaCounter.inc({ resultado: 'rechazada' }, 0);
aseguradosRegistradosCounter.inc(0);
