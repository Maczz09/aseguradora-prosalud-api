'use strict';

const express = require('express');

const backpressureMiddleware = require('../middleware/backpressure.middleware');
const apiKeyMiddleware       = require('../middleware/apiKey.middleware');
const AseguradosController   = require('../controllers/AseguradosController');
const ValidacionService      = require('../services/ValidacionService');
const RegistroService        = require('../services/RegistroService');
const AseguradosRepository   = require('../repositories/AseguradosRepository');
const OutboxRepository       = require('../repositories/OutboxRepository');

// ── Composición de dependencias ───────────────────────────────────────────────
const aseguradosRepo    = new AseguradosRepository();
const outboxRepo        = new OutboxRepository();
const validacionService = new ValidacionService(aseguradosRepo, outboxRepo);
const registroService   = new RegistroService(aseguradosRepo);
const controller        = new AseguradosController(validacionService, registroService);

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

/**
 * @swagger
 * /asegurados:
 *   post:
 *     summary: Registra un nuevo asegurado con su póliza y porcentaje de cobertura
 *     description: |
 *       Crea de forma atómica (transacción) un asegurado y su póliza asociada.
 *
 *       Campos obligatorios: `nombre`, `apellido`, `tipoDocumento`,
 *       `numeroDocumento` y `porcentajeCobertura`. El resto son opcionales:
 *       - `plan` → por defecto `Plan Estándar`
 *       - `numeroPoliza` → autogenerado (`POL-<año>-<hex>`) si se omite
 *       - `fechaInicio` → hoy si se omite
 *       - `fechaFin` → un año después de `fechaInicio` si se omite
 *       - `estado` → `VIGENTE` por defecto
 *
 *       Tras crearlo, el asegurado puede consultarse en `GET /asegurados/validar`.
 *     tags: [Asegurados]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, apellido, tipoDocumento, numeroDocumento, porcentajeCobertura]
 *             properties:
 *               nombre:              { type: string, example: Juan }
 *               apellido:            { type: string, example: Pérez Ramos }
 *               tipoDocumento:       { type: string, enum: [DNI, CE, PASAPORTE], example: DNI }
 *               numeroDocumento:     { type: string, minLength: 5, maxLength: 20, example: '55667788' }
 *               porcentajeCobertura: { type: number, minimum: 0, maximum: 100, example: 75 }
 *               fechaNacimiento:     { type: string, format: date, example: '1990-05-10' }
 *               plan:                { type: string, example: Plan Salud Plus }
 *               numeroPoliza:        { type: string, example: POL-2026-010 }
 *               fechaInicio:         { type: string, format: date, example: '2026-01-01' }
 *               fechaFin:            { type: string, format: date, example: '2027-12-31' }
 *               estado:              { type: string, enum: [VIGENTE, VENCIDA, SUSPENDIDA], example: VIGENTE }
 *     responses:
 *       201:
 *         description: Asegurado y póliza creados
 *       400:
 *         description: Parámetros inválidos o faltantes
 *       401:
 *         description: API Key ausente o incorrecta
 *       409:
 *         description: Documento o número de póliza ya existen
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  '/',
  backpressureMiddleware,
  apiKeyMiddleware,
  controller.crear,
);

/**
 * @swagger
 * /asegurados/poliza/{numeroPoliza}/estado:
 *   patch:
 *     summary: Actualiza manualmente el estado de una póliza (Dispara Webhook)
 *     description: Permite cambiar el estado de VIGENTE a SUSPENDIDA o VENCIDA.
 *     tags: [Asegurados]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: numeroPoliza
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado: { type: string, enum: [VIGENTE, VENCIDA, SUSPENDIDA] }
 *     responses:
 *       200:
 *         description: Estado actualizado
 *       400:
 *         description: Estado inválido
 *       404:
 *         description: Póliza no encontrada
 */
router.patch(
  '/poliza/:numeroPoliza/estado',
  apiKeyMiddleware,
  controller.actualizarEstado.bind(controller) // El binding es necesario si no se hizo en el constructor
);

module.exports = router;
