'use strict';

const axios = require('axios');
const axiosRetry = require('axios-retry').default;

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_MEDICITAS_URL;
    this.apiKey = process.env.API_KEY || 'test-api-key-12345'; // Llave para autenticarse con el backend médico

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
      console.warn('[WebhookService] WEBHOOK_MEDICITAS_URL no está configurada. Omitiendo notificación.');
      return;
    }

    const payload = {
      numeroPoliza,
      estadoAnterior,
      nuevoEstado,
      fechaActualizacion: new Date().toISOString()
    };

    try {
      console.log(`[WebhookService] Enviando actualización de póliza ${numeroPoliza} a ${this.webhookUrl}`);
      
      const response = await this.client.post(this.webhookUrl, payload, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      console.log(`[WebhookService] Webhook entregado con éxito (Status: ${response.status})`);
      return true;
    } catch (error) {
      console.error(
        `[WebhookService] Error crítico entregando webhook tras reintentos a ${this.webhookUrl}:`,
        error.message
      );
      return false; // Silenciamos la excepción para no romper la transacción principal
    }
  }
}

module.exports = new WebhookService();
