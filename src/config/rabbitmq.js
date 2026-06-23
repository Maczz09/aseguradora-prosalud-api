'use strict';
require('dotenv').config();

const amqplib = require('amqplib');

let connection = null;
let channel    = null;

const EXCHANGE = 'aseguradora.events';
const QUEUES   = {
  auditoria: 'q.aseguradora.auditoria',
  auditoriaDlq: 'q.aseguradora.auditoria.dlq',
};

/**
 * Establece la conexión con RabbitMQ y declara la topología.
 * Reintenta hasta `maxRetries` veces con backoff lineal.
 */
async function conectar(maxRetries = 10, delayMs = 3000) {
  for (let intento = 1; intento <= maxRetries; intento++) {
    try {
      console.log(`[RABBITMQ] Conectando... (intento ${intento}/${maxRetries})`);

      connection = await amqplib.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
      channel    = await connection.createChannel();

      // ── Declarar topología ──────────────────────────────────────────────────
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      await channel.assertQueue(QUEUES.auditoriaDlq, { durable: true });

      await channel.assertQueue(QUEUES.auditoria, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange':    '',
          'x-dead-letter-routing-key': QUEUES.auditoriaDlq,
        },
      });

      await channel.bindQueue(QUEUES.auditoria, EXCHANGE, '#');

      connection.on('error',  (err) => console.error('[RABBITMQ] Error de conexión:', err.message));
      connection.on('close',  ()    => console.warn('[RABBITMQ] Conexión cerrada.'));

      console.log('[RABBITMQ] Conectado y topología declarada correctamente.');
      return channel;
    } catch (err) {
      console.error(`[RABBITMQ] Fallo en intento ${intento}:`, err.message);
      if (intento === maxRetries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Devuelve el canal activo. Lanza error si no se ha inicializado.
 */
function getChannel() {
  if (!channel) throw new Error('[RABBITMQ] Canal no inicializado. Llamar a conectar() primero.');
  return channel;
}

module.exports = { conectar, getChannel, EXCHANGE, QUEUES };
