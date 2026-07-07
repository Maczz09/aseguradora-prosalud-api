'use strict';

// DEBE ser el primer require: instala los hooks de auto-instrumentación antes
// de que cualquier módulo (express, http, mysql2, amqplib) sea cargado por primera vez.
require('./tracing');

const logger = require('./config/logger');

require('dotenv').config();

const app                    = require('./app');
const pool                   = require('./config/database');
const { conectar }           = require('./config/rabbitmq');
const { iniciarOutboxWorker }     = require('./workers/outbox.worker');
const { iniciarConsumerAuditoria } = require('./workers/auditoriaLocal.consumer');
const { iniciarWorkerWebhooksSalientes } = require('./workers/webhooksSalientes.worker');
const WebhooksSalientesRepository = require('./repositories/WebhooksSalientesRepository');
const webhookService = require('./services/WebhookService');

const PORT = parseInt(process.env.PORT || '4001');

async function arrancar() {
  // ── 1. Verificar conexión MySQL ──────────────────────────────────────────────
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    logger.info('[DB] Conectado a db_aseguradora correctamente.');
  } catch (err) {
    logger.error('[DB] No se pudo conectar a MySQL:', err.message);
    process.exit(1);
  }

  // ── 2. Conectar RabbitMQ y declarar topología ──────────────────────────────
  try {
    await conectar();
  } catch (err) {
    logger.error('[RABBITMQ] No se pudo conectar:', err.message);
    // RabbitMQ es opcional para el inicio — el outbox fallará silenciosamente
    // si no está disponible, pero el endpoint HTTP seguirá respondiendo.
    logger.warn('[RABBITMQ] Continuando sin RabbitMQ — los eventos quedarán en outbox.');
  }

  // ── 3. Iniciar workers ─────────────────────────────────────────────────────
  iniciarOutboxWorker();

  const webhooksSalientesRepository = new WebhooksSalientesRepository();
  webhookService.init(webhooksSalientesRepository);
  iniciarWorkerWebhooksSalientes(webhooksSalientesRepository);

  try {
    await iniciarConsumerAuditoria();
  } catch (err) {
    logger.warn('[AUDITORIA_CONSUMER] No se pudo iniciar el consumer:', err.message);
  }

  // ── 4. Levantar servidor HTTP ──────────────────────────────────────────────
  app.listen(PORT, () => {
    logger.info(`[SERVER] Aseguradora ProSalud API corriendo en puerto ${PORT}`);
    logger.info(`[SERVER] Swagger UI: http://localhost:${PORT}/api-docs`);
    logger.info(`[SERVER] Health:     http://localhost:${PORT}/health`);
  });
}

arrancar().catch((err) => {
  logger.error('[SERVER] Error fatal al arrancar:', err);
  process.exit(1);
});
