'use strict';

require('dotenv').config();

const app                    = require('./app');
const pool                   = require('./config/database');
const { conectar }           = require('./config/rabbitmq');
const { iniciarOutboxWorker }     = require('./workers/outbox.worker');
const { iniciarConsumerAuditoria } = require('./workers/auditoriaLocal.consumer');

const PORT = parseInt(process.env.PORT || '4001');

async function arrancar() {
  // ── 1. Verificar conexión MySQL ──────────────────────────────────────────────
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[DB] Conectado a db_aseguradora correctamente.');
  } catch (err) {
    console.error('[DB] No se pudo conectar a MySQL:', err.message);
    process.exit(1);
  }

  // ── 2. Conectar RabbitMQ y declarar topología ──────────────────────────────
  try {
    await conectar();
  } catch (err) {
    console.error('[RABBITMQ] No se pudo conectar:', err.message);
    // RabbitMQ es opcional para el inicio — el outbox fallará silenciosamente
    // si no está disponible, pero el endpoint HTTP seguirá respondiendo.
    console.warn('[RABBITMQ] Continuando sin RabbitMQ — los eventos quedarán en outbox.');
  }

  // ── 3. Iniciar workers ─────────────────────────────────────────────────────
  iniciarOutboxWorker();

  try {
    await iniciarConsumerAuditoria();
  } catch (err) {
    console.warn('[AUDITORIA_CONSUMER] No se pudo iniciar el consumer:', err.message);
  }

  // ── 4. Levantar servidor HTTP ──────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`[SERVER] Aseguradora ProSalud API corriendo en puerto ${PORT}`);
    console.log(`[SERVER] Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`[SERVER] Health:     http://localhost:${PORT}/health`);
  });
}

arrancar().catch((err) => {
  console.error('[SERVER] Error fatal al arrancar:', err);
  process.exit(1);
});
