'use strict';

require('dotenv').config();

const express        = require('express');
const helmet         = require('helmet');
const cors           = require('cors');
const swaggerUi      = require('swagger-ui-express');
const swaggerSpec    = require('./config/swagger.config');
const aseguradosRoutes = require('./routes/asegurados.routes');

const app = express();

// ── Seguridad y utilidades ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
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

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', servicio: 'aseguradora-prosalud-api' }));

// ── Ruta no encontrada ─────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ codigo: 'RUTA_NO_ENCONTRADA', mensaje: `${req.method} ${req.path} no existe.` });
});

// ── Error middleware global ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(500).json({
    codigo:  'ERROR_INTERNO_ASEGURADORA',
    mensaje: 'Error interno del servidor. Intente nuevamente.',
  });
});

module.exports = app;
