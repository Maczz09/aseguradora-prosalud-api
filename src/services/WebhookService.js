'use strict';

const logger = require('../config/logger');

const axios = require('axios');
const axiosRetry = require('axios-retry').default;

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_MEDICITAS_URL;
    // Secreto compartido bidireccional: la misma ASEGURADORA_API_KEY que
    // MediCitas usa para llamarnos autentica nuestros webhooks hacia MediCitas.
    this.apiKey = process.env.ASEGURADORA_API_KEY;

    this.client = axios.create({
      timeout: 5000,
    });

    // Configuración de reintentos exponenciales
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500;
      },
    });
  }

  init(webhooksSalientesRepository) {
    this.webhooksRepo = webhooksSalientesRepository;
  }

  async enviarActualizacionPoliza({ numeroPoliza, estadoAnterior, nuevoEstado }) {
    if (!this.webhookUrl) {
      logger.warn('[WebhookService] WEBHOOK_MEDICITAS_URL no está configurada. Omitiendo notificación.');
      return;
    }
    if (!this.apiKey) {
      logger.error('[WebhookService] ASEGURADORA_API_KEY no configurada — webhook omitido');
      return false;
    }

    const payload = {
      numeroPoliza,
      estadoAnterior,
      nuevoEstado,
      fechaActualizacion: new Date().toISOString()
    };

    try {
      logger.info(`[WebhookService] Enviando actualización de póliza ${numeroPoliza} a ${this.webhookUrl}`);

      const response = await this.client.post(this.webhookUrl, payload, {
        headers: {
          'X-Webhook-Api-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`[WebhookService] Webhook entregado con éxito (Status: ${response.status})`);
      return true;
    } catch (error) {
      logger.error(
        `[WebhookService] Entrega inmediata falló tras reintentos a ${this.webhookUrl} — se encola en outbox local:`,
        error.message
      );

      // Outbox local: la entrega inmediata (con reintento en memoria) agotó
      // sus intentos. Se persiste para que webhooksSalientes.worker.js siga
      // reintentando con backoff hasta que MediCitas vuelva a responder —
      // así ningún cambio de póliza se pierde por una caída transitoria.
      if (this.webhooksRepo) {
        try {
          await this.webhooksRepo.encolar({ tipoEvento: 'PolizaActualizada', payload, urlDestino: this.webhookUrl });
        } catch (dbError) {
          logger.error(`[WebhookService] CRÍTICO: no se pudo encolar el webhook en el outbox local. Sincronización perdida:`, dbError.message);
        }
      }
      return false; // Silenciamos la excepción para no romper la transacción principal
    }
  }

  /**
   * Entrega cruda de un payload ya encolado (usada por webhooksSalientes.worker.js
   * para reintentar filas PENDIENTE). Lanza si falla.
   */
  async intentarEntrega(urlDestino, payload) {
    if (!this.apiKey) throw new Error('ASEGURADORA_API_KEY no configurada');
    await this.client.post(urlDestino, payload, {
      headers: { 'X-Webhook-Api-Key': this.apiKey, 'Content-Type': 'application/json' },
    });
  }
}

module.exports = new WebhookService();
