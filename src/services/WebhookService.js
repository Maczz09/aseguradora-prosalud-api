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
        `[WebhookService] Error crítico entregando webhook tras reintentos a ${this.webhookUrl}:`,
        error.message
      );
      return false; // Silenciamos la excepción para no romper la transacción principal
    }
  }
}

module.exports = new WebhookService();
