'use strict';

const cron = require('node-cron');
const logger = require('../config/logger');
const webhookService = require('../services/WebhookService');
const { webhooksSalientesPendientesGauge } = require('../config/metrics');

// Reintenta en background los webhooks que la entrega inmediata (en
// WebhookService.enviarActualizacionPoliza) no pudo completar — outbox local
// para que ningún cambio de póliza se pierda por una caída transitoria de
// MediCitas. Corre cada 30s; cada fila respeta su propio backoff
// (proximo_intento_en) calculado por el repositorio.
function iniciarWorkerWebhooksSalientes(webhooksSalientesRepository) {
  cron.schedule('*/30 * * * * *', async () => {
    let pendientes;
    try {
      pendientes = await webhooksSalientesRepository.obtenerPendientes(20);
    } catch (err) {
      logger.error('[WebhooksSalientes] Error consultando pendientes:', err.message);
      return;
    }

    for (const item of pendientes) {
      try {
        await webhookService.intentarEntrega(item.url_destino, item.payload);
        await webhooksSalientesRepository.marcarEntregado(item.id);
        logger.info(`[WebhooksSalientes] Entregado en reintento de background: ${item.id} (${item.tipo_evento})`);
      } catch (err) {
        const resultado = await webhooksSalientesRepository.marcarReintento(item.id, item.intentos, err.message);
        if (resultado === 'FALLIDO_PERMANENTE') {
          logger.error(`[WebhooksSalientes] ALERTA: webhook ${item.id} (${item.tipo_evento}) agotó reintentos — requiere reconciliación manual. Payload:`, JSON.stringify(item.payload));
        } else {
          logger.warn(`[WebhooksSalientes] Reintento fallido para ${item.id} (intento ${item.intentos + 1}):`, err.message);
        }
      }
    }

    try {
      webhooksSalientesPendientesGauge.set(await webhooksSalientesRepository.contarPendientes());
    } catch { /* no crítico — se reintenta en el próximo ciclo */ }
  });
  logger.info('[WebhooksSalientes] Worker de outbox iniciado (cada 30s).');
}

module.exports = { iniciarWorkerWebhooksSalientes };
