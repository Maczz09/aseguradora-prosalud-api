'use strict';

const logger = require('../config/logger');

/**
 * OutboxWorker — publica eventos pendientes a RabbitMQ cada 10 segundos.
 *
 * Patrón Transactional Outbox:
 *   1. ValidacionService escribe el evento en la tabla `outbox` (INSERT local, rápido)
 *   2. Este worker lo lee y lo publica a RabbitMQ (de forma asíncrona)
 *   3. Solo marca `publicado = 1` si RabbitMQ lo acepta
 *   4. Si falla, incrementa `intentos`; tras 5 intentos fallidos se abandona
 *      (el mensaje quedará en la tabla para revisión manual o DLQ)
 *
 * Resultado: ValidacionService nunca espera a RabbitMQ — la latencia de la
 * respuesta HTTP no depende de la disponibilidad del broker.
 */

const cron = require('node-cron');
const pool = require('../config/database');
const { getChannel, EXCHANGE } = require('../config/rabbitmq');

const MAX_INTENTOS  = 5;
const BATCH_SIZE    = 20;

async function procesarOutbox() {
  let channel;
  try {
    channel = getChannel();
  } catch {
    // RabbitMQ aún no está conectado — se reintentará en el próximo ciclo
    logger.warn('[OUTBOX_WORKER] Canal RabbitMQ no disponible aún, se reintentará.');
    return;
  }

  const [eventos] = await pool.execute(
    `SELECT id, evento, payload
       FROM outbox
      WHERE publicado = 0
        AND intentos  < ?
      ORDER BY created_at ASC
      LIMIT ?`,
    [MAX_INTENTOS, BATCH_SIZE],
  );

  if (eventos.length === 0) return;

  logger.info(`[OUTBOX_WORKER] Procesando ${eventos.length} evento(s) pendiente(s).`);

  for (const ev of eventos) {
    try {
      // El routing key es el nombre del evento (ej: 'PolizaValidada')
      const publicado = channel.publish(
        EXCHANGE,
        ev.evento,
        Buffer.from(typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload)),
        { persistent: true },
      );

      if (!publicado) throw new Error('channel.publish devolvió false (backpressure de RabbitMQ)');

      await pool.execute(
        'UPDATE outbox SET publicado = 1 WHERE id = ?',
        [ev.id],
      );
    } catch (err) {
      logger.error(`[OUTBOX_WORKER] Error publicando evento ${ev.id}:`, err.message);
      await pool.execute(
        'UPDATE outbox SET intentos = intentos + 1 WHERE id = ?',
        [ev.id],
      );
    }
  }
}

function iniciarOutboxWorker() {
  // Cada 10 segundos
  cron.schedule('*/10 * * * * *', async () => {
    try {
      await procesarOutbox();
    } catch (err) {
      logger.error('[OUTBOX_WORKER] Error inesperado:', err.message);
    }
  });

  logger.info('[OUTBOX_WORKER] Iniciado — polling cada 10 segundos.');
}

module.exports = { iniciarOutboxWorker };
