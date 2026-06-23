'use strict';

const TIPOS_VALIDOS = ['DNI', 'CE', 'PASAPORTE'];

class AseguradosController {
  /**
   * @param {ValidacionService} validacionService
   */
  constructor(validacionService) {
    this.validacionService = validacionService;

    // Bind para poder pasar como referencia directa a Express
    this.validar = this.validar.bind(this);
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
}

module.exports = AseguradosController;
