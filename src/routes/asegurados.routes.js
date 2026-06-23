'use strict';

const express = require('express');

const backpressureMiddleware = require('../middleware/backpressure.middleware');
const apiKeyMiddleware       = require('../middleware/apiKey.middleware');
const AseguradosController   = require('../controllers/AseguradosController');
const ValidacionService      = require('../services/ValidacionService');
const AseguradosRepository   = require('../repositories/AseguradosRepository');
const OutboxRepository       = require('../repositories/OutboxRepository');

// ── Composición de dependencias ───────────────────────────────────────────────
const aseguradosRepo    = new AseguradosRepository();
const outboxRepo        = new OutboxRepository();
const validacionService = new ValidacionService(aseguradosRepo, outboxRepo);
const controller        = new AseguradosController(validacionService);

const router = express.Router();

/**
 * @swagger
 * /asegurados/validar:
 *   get:
 *     summary: Valida si un documento de identidad tiene una póliza vigente
 *     description: |
 *       Verifica en tiempo real si el asegurado identificado por `tipoDocumento` y
 *       `numeroDocumento` tiene una póliza en estado VIGENTE.
 *
 *       - `asegurado: true`  → tiene póliza vigente; incluye `porcentajeCobertura`, `vigencia`, etc.
 *       - `asegurado: false` → no encontrado o póliza vencida/suspendida.
 *
 *       El servicio registra la validación de forma asíncrona (Outbox → RabbitMQ → historial_validaciones)
 *       **sin** agregar latencia a esta respuesta.
 *     tags: [Asegurados]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: tipoDocumento
 *         required: true
 *         schema:
 *           type: string
 *           enum: [DNI, CE, PASAPORTE]
 *         description: Tipo de documento de identidad del asegurado
 *         example: DNI
 *       - in: query
 *         name: numeroDocumento
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 5
 *           maxLength: 20
 *         description: Número del documento de identidad
 *         example: '12345678'
 *     responses:
 *       200:
 *         description: Resultado de la validación
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - description: Asegurado con póliza vigente
 *                   type: object
 *                   properties:
 *                     asegurado:
 *                       type: boolean
 *                       example: true
 *                     numeroPoliza:
 *                       type: string
 *                       example: POL-2024-001
 *                     plan:
 *                       type: string
 *                       example: Plan Salud Plus
 *                     porcentajeCobertura:
 *                       type: number
 *                       example: 80
 *                     vigencia:
 *                       type: object
 *                       properties:
 *                         fechaInicio:
 *                           type: string
 *                           format: date
 *                         fechaFin:
 *                           type: string
 *                           format: date
 *                 - description: Asegurado sin póliza vigente
 *                   type: object
 *                   properties:
 *                     asegurado:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Parámetros inválidos o faltantes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codigo:
 *                   type: string
 *                   example: PARAMETROS_INVALIDOS
 *                 mensaje:
 *                   type: string
 *       401:
 *         description: API Key ausente o incorrecta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codigo:
 *                   type: string
 *                   example: API_KEY_INVALIDA
 *                 mensaje:
 *                   type: string
 *       503:
 *         description: Servicio saturado — backpressure activado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codigo:
 *                   type: string
 *                   example: SERVICIO_SATURADO
 *                 mensaje:
 *                   type: string
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codigo:
 *                   type: string
 *                   example: ERROR_INTERNO_ASEGURADORA
 *                 mensaje:
 *                   type: string
 */
router.get(
  '/validar',
  backpressureMiddleware,
  apiKeyMiddleware,
  controller.validar,
);

module.exports = router;
