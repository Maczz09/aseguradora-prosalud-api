'use strict';

const TIPOS_VALIDOS   = ['DNI', 'CE', 'PASAPORTE'];
const ESTADOS_VALIDOS = ['VIGENTE', 'VENCIDA', 'SUSPENDIDA'];
const FECHA_REGEX     = /^\d{4}-\d{2}-\d{2}$/;

// Reglas de formato del número de documento, por tipo.
//   DNI       → exactamente 8 dígitos numéricos
//   CE        → 6 a 12 caracteres alfanuméricos
//   PASAPORTE → 6 a 12 caracteres alfanuméricos
const REGLAS_DOCUMENTO = {
  DNI:       { regex: /^\d{8}$/,             mensaje: 'El DNI debe tener exactamente 8 dígitos.' },
  CE:        { regex: /^[A-Za-z0-9]{6,12}$/, mensaje: 'El CE debe ser alfanumérico de 6 a 12 caracteres.' },
  PASAPORTE: { regex: /^[A-Za-z0-9]{6,12}$/, mensaje: 'El pasaporte debe ser alfanumérico de 6 a 12 caracteres.' },
};

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
   * GET /api/v1/asegurados/validar?tipoDocumento=DNI&numeroDocumento=12345678
   *
   * Respuestas:
   *   200 — { asegurado: true,  numeroPoliza, plan, porcentajeCobertura, vigencia }
   *   200 — { asegurado: false }
   *   400 — { codigo: 'PARAMETROS_INVALIDOS', mensaje }
   *   500 — { codigo: 'ERROR_INTERNO_ASEGURADORA', mensaje }
   */
  async validar(req, res, next) {
    try {
      const { tipoDocumento, numeroDocumento } = req.query;

      // ── Validar parámetros obligatorios ──────────────────────────────────────
      if (!tipoDocumento || !numeroDocumento) {
        return res.status(400).json({
          codigo:  'PARAMETROS_INVALIDOS',
          mensaje: 'Los parámetros tipoDocumento y numeroDocumento son obligatorios.',
        });
      }

      if (!TIPOS_VALIDOS.includes(tipoDocumento.toUpperCase())) {
        return res.status(400).json({
          codigo:  'PARAMETROS_INVALIDOS',
          mensaje: `tipoDocumento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`,
        });
      }

      const resultado = await this.validacionService.validar(
        tipoDocumento.toUpperCase(),
        numeroDocumento.trim(),
      );

      return res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/asegurados
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
      const b = req.body || {};
      const errores = [];

      const nombre          = typeof b.nombre === 'string' ? b.nombre.trim() : '';
      const apellido        = typeof b.apellido === 'string' ? b.apellido.trim() : '';
      const tipoDocumento   = typeof b.tipoDocumento === 'string' ? b.tipoDocumento.trim().toUpperCase() : '';
      const numeroDocumento = b.numeroDocumento != null ? String(b.numeroDocumento).trim() : '';
      const porcentaje      = Number(b.porcentajeCobertura);

      if (!nombre)   errores.push('nombre es obligatorio.');
      if (!apellido) errores.push('apellido es obligatorio.');
      if (!TIPOS_VALIDOS.includes(tipoDocumento)) {
        errores.push(`tipoDocumento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.`);
      } else {
        // El formato del número depende del tipo de documento.
        const regla = REGLAS_DOCUMENTO[tipoDocumento];
        if (!regla.regex.test(numeroDocumento)) {
          errores.push(regla.mensaje);
        }
      }
      if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        errores.push('porcentajeCobertura debe ser un número entre 0 y 100.');
      }

      // ── Opcionales con validación ligera ─────────────────────────────────────
      const estado = b.estado != null ? String(b.estado).trim().toUpperCase() : 'VIGENTE';
      if (!ESTADOS_VALIDOS.includes(estado)) {
        errores.push(`estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`);
      }
      for (const campo of ['fechaInicio', 'fechaFin', 'fechaNacimiento']) {
        if (b[campo] != null && b[campo] !== '' && !FECHA_REGEX.test(String(b[campo]))) {
          errores.push(`${campo} debe tener formato YYYY-MM-DD.`);
        }
      }

      if (errores.length > 0) {
        return res.status(400).json({ codigo: 'PARAMETROS_INVALIDOS', mensaje: errores.join(' ') });
      }

      const creado = await this.registroService.registrar({
        nombre,
        apellido,
        tipoDocumento,
        numeroDocumento,
        porcentajeCobertura: porcentaje,
        fechaNacimiento: b.fechaNacimiento || null,
        plan:            typeof b.plan === 'string' && b.plan.trim() ? b.plan.trim() : undefined,
        numeroPoliza:    typeof b.numeroPoliza === 'string' && b.numeroPoliza.trim() ? b.numeroPoliza.trim() : undefined,
        fechaInicio:     b.fechaInicio || undefined,
        fechaFin:        b.fechaFin || undefined,
        estado,
      });

      return res.status(201).json(creado);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          codigo:  'RECURSO_DUPLICADO',
          mensaje: 'Ya existe un asegurado con ese documento o una póliza con ese número.',
        });
      }
      next(err);
    }
  }
  /**
   * PATCH /api/v1/asegurados/poliza/:numeroPoliza/estado
   */
  async actualizarEstado(req, res, next) {
    try {
      const { numeroPoliza } = req.params;
      const { estado } = req.body;

      if (!estado || !ESTADOS_VALIDOS.includes(estado.toUpperCase())) {
        return res.status(400).json({
          codigo: 'PARAMETROS_INVALIDOS',
          mensaje: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`
        });
      }

      // Buscar póliza y asegurado
      const poliza = await this.validacionService.repo.obtenerPorPoliza(numeroPoliza);
      if (!poliza) {
        return res.status(404).json({
          codigo: 'POLIZA_NO_ENCONTRADA',
          mensaje: `No existe la póliza ${numeroPoliza}.`
        });
      }

      const estadoAnterior = poliza.estado;
      const nuevoEstado = estado.toUpperCase();

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
