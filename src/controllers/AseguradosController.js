'use strict';

const { DomainError } = require('../domain/errors');

class AseguradosController {
  /**
   * @param {ValidacionService} validacionService
   * @param {RegistroService}   registroService
   */
  constructor(validacionService, registroService) {
    this.validacionService = validacionService;
    this.registroService   = registroService;

    // Bind para poder pasar como referencia directa a Express
    this.validar = this.validar.bind(this);
    this.crear   = this.crear.bind(this);
  }

  /**
   * GET /api/v2/asegurados/validar?tipoDocumento=DNI&numeroDocumento=12345678
   *
   * Respuestas:
   *   200 — { asegurado: true,  numeroPoliza, plan, porcentajeCobertura, vigencia }
   *   200 — { asegurado: false }
   *   400 — { codigo: 'PARAMETROS_INVALIDOS', mensaje }
   *   500 — { codigo: 'ERROR_INTERNO_ASEGURADORA', mensaje }
   */
  async validar(req, res, next) {
    try {
      // req.query ya fue validado y normalizado (mayúsculas/trim) por Zod.
      const { tipoDocumento, numeroDocumento } = req.query;

      const resultado = await this.validacionService.validar(tipoDocumento, numeroDocumento);

      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v2/asegurados
   *
   * Crea un asegurado y su póliza (con porcentaje de cobertura) en una sola
   * operación. Campos obligatorios: nombre, apellido, tipoDocumento,
   * numeroDocumento, porcentajeCobertura. El resto son opcionales y reciben
   * valores por defecto.
   *
   * Respuestas:
   *   201 — recurso creado { idAsegurado, ..., poliza: { porcentajeCobertura, ... } }
   *   400 — { codigo: 'PARAMETROS_INVALIDOS', mensaje }
   *   409 — { codigo: 'RECURSO_DUPLICADO', mensaje }   (documento o póliza ya existen)
   *   500 — { codigo: 'ERROR_INTERNO_ASEGURADORA', mensaje }
   */
  async crear(req, res, next) {
    try {
      // req.body ya fue validado y normalizado por Zod (crearAseguradoSchema):
      // tipoDocumento/estado en mayúsculas, porcentajeCobertura numérico, etc.
      const creado = await this.registroService.registrar(req.body);

      return res.status(201).json(creado);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return next(new DomainError('RECURSO_DUPLICADO', 409, 'Ya existe un asegurado con ese documento o una póliza con ese número.'));
      }
      next(err);
    }
  }
  /**
   * PATCH /api/v2/asegurados/poliza/:numeroPoliza/estado
   */
  async actualizarEstado(req, res, next) {
    try {
      const { numeroPoliza } = req.params;
      // req.body.estado ya fue validado y normalizado (mayúsculas) por Zod.
      const { estado } = req.body;

      // Buscar póliza y asegurado
      const poliza = await this.validacionService.repo.obtenerPorPoliza(numeroPoliza);
      if (!poliza) {
        return next(new DomainError('POLIZA_NO_ENCONTRADA', 404, `No existe la póliza ${numeroPoliza}.`));
      }

      const estadoAnterior = poliza.estado;
      const nuevoEstado = estado;

      if (estadoAnterior === nuevoEstado) {
        return res.status(200).json({ mensaje: 'La póliza ya se encuentra en ese estado.' });
      }

      // Actualizar en base de datos
      await this.validacionService.repo.actualizarEstadoPoliza(numeroPoliza, nuevoEstado);

      // Despachar webhook
      const webhookService = require('../services/WebhookService');
      // No esperamos a que responda el webhook (fire-and-forget o background async)
      webhookService.enviarActualizacionPoliza({
        numeroPoliza,
        estadoAnterior,
        nuevoEstado
      });

      return res.status(200).json({
        mensaje: 'Estado actualizado correctamente',
        numeroPoliza,
        estadoAnterior,
        nuevoEstado
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AseguradosController;
