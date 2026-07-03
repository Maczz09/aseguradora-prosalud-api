'use strict';

/**
 * Bootstrap de OpenTelemetry — tracing distribuido hacia Jaeger.
 * DEBE ser el primer require de server.js (ver src/tracing.js de medicitas-backend).
 */

require('dotenv').config();

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318/v1/traces';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'aseguradora-api',
  }),
  traceExporter: new OTLPTraceExporter({ url: OTEL_ENDPOINT }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
  console.log(`[Tracing] OpenTelemetry iniciado — exportando a ${OTEL_ENDPOINT}`);
} catch (err) {
  console.error('[Tracing] No se pudo iniciar OpenTelemetry:', err.message);
}

process.on('SIGTERM', () => {
  sdk.shutdown().catch(() => {});
});
