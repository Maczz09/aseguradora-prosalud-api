'use strict';

const logger = require('./config/logger');

require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger.config');
const aseguradosRoutes = require('./routes/asegurados.routes');
const { correlationIdMiddleware } = require('./middleware/correlationId.middleware');
const { errorHandler } = require('./middleware/errorHandler.middleware');
const { metricsMiddleware } = require('./middleware/metrics.middleware');
const { register } = require('./config/metrics');

const app = express();

// ── Seguridad y utilidades ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(metricsMiddleware);
app.use(correlationIdMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Swagger UI ─────────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Aseguradora ProSalud — API Docs',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// Endpoint para obtener el spec en JSON (útil para herramientas externas)
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ── Rutas ──────────────────────────────────────────────────────────────────────
app.use('/api/v1/asegurados', aseguradosRoutes);

// 🚀 Health check ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Healthcheck del sistema
 *     description: Endpoint para verificar que el servicio está vivo y responde. Usado por balanceadores de carga y el autoheal.
 *     tags:
 *       - Infraestructura
 *     responses:
 *       200:
 *         description: El servicio está operando correctamente
 */
app.get('/health', (req, res) => res.json({ status: 'ok', servicio: 'aseguradora-prosalud-api' }));

// Endpoint de métricas para Prometheus (scrape interno, sin autenticación
// como el resto del stack — no expone datos de negocio, solo agregados).
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// ── Ruta no encontrada ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    codigo: 'RUTA_NO_ENCONTRADA',
    mensaje: `${req.method} ${req.path} no existe.`,
    correlationId: req.correlationId || null,
    timestamp: new Date().toISOString(),
  });
});

// ── Error middleware global ────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
