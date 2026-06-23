'use strict';

const { randomUUID } = require('crypto');
const pool           = require('../config/database');
const { getChannel, QUEUES } = require('../config/rabbitmq');

/**
 * AuditoriaLocalWorker — consumer de q.aseguradora.auditoria.
 *
 * Por cada mensaje que llega de RabbitMQ (publicado por el OutboxWorker):
 *   1. Parsea el payload
 *   2. Inserta una fila en historial_validaciones
 *   3. Hace ack — si falla, nack y el mensaje va a la DLQ
 *
 * historial_validaciones es un log de auditoría: redundante, deliberado,
 * consultable después. No se usa para responder en tiempo real.
 */
async function iniciarConsumerAuditoria() {
  const channel = getChannel();
  const QUEUE   = QUEUES.auditoria;

  // Procesar de a 1 mensaje a la vez — evita saturar el pool de MySQL
  await channel.prefetch(1);

  await channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    let evento;
    try {
      evento = JSON.parse(msg.content.toString());
    } catch (err) {
      console.error('[AUDITORIA_CONSUMER] Mensaje con JSON inválido:', msg.content.toString());
      channel.nack(msg, false, false); // descartar, va a DLQ
      return;
    }

    const { tipoDocumento, numeroDocumento, numeroPoliza, porcentajeCobertura } = evento.payload || evento;
    const resultado = evento.evento === 'PolizaValidada' ? 'VALIDADO' : 'NO_ENCONTRADO';

    try {
      await pool.execute(
        `INSERT INTO historial_validaciones
           (id, tipo_documento, numero_documento, resultado, numero_poliza, porcentaje_cobertura)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          tipoDocumento,
          numeroDocumento,
          resultado,
          numeroPoliza   || null,
          porcentajeCobertura || null,
        ],
      );

      channel.ack(msg);
      console.log(`[AUDITORIA_CONSUMER] Auditoria registrada: ${resultado} — ${tipoDocumento}:${numeroDocumento}`);
    } catch (err) {
      console.error('[AUDITORIA_CONSUMER] Error insertando historial:', err.message);
      // nack sin requeue — el mensaje irá a la DLQ para revisión
      channel.nack(msg, false, false);
    }
  });

  console.log(`[AUDITORIA_CONSUMER] Escuchando en cola: ${QUEUE}`);
}

module.exports = { iniciarConsumerAuditoria };
