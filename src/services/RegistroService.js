'use strict';

const { randomUUID } = require('crypto');
const { aseguradosRegistradosCounter } = require('../config/metrics');

/**
 * Servicio de registro de asegurados.
 *
 * Crea un asegurado y su póliza (con el porcentaje de cobertura) en una sola
 * operación atómica. Aplica valores por defecto razonables para los campos
 * opcionales, de modo que el caso mínimo solo requiera:
 *   nombre, apellido, tipoDocumento, numeroDocumento, porcentajeCobertura.
 */
class RegistroService {
  /**
   * @param {AseguradosRepository} aseguradosRepository
   */
  constructor(aseguradosRepository) {
    this.repo = aseguradosRepository;
  }

  /**
   * Registra un nuevo asegurado con su póliza.
   * Asume que el DTO ya viene validado por el controlador.
   *
   * @param {object} dto
   * @returns {object} Representación del recurso creado
   */
  async registrar(dto) {
    const idAsegurado = randomUUID();
    const idPoliza    = randomUUID();

    const hoy        = new Date();
    const fechaInicio = dto.fechaInicio || hoy.toISOString().split('T')[0];
    const fechaFin    = dto.fechaFin || RegistroService._sumarUnAnio(fechaInicio);

    const asegurado = {
      id:              idAsegurado,
      nombre:          dto.nombre,
      apellido:        dto.apellido,
      tipoDocumento:   dto.tipoDocumento,
      numeroDocumento: dto.numeroDocumento,
      fechaNacimiento: dto.fechaNacimiento || null,
    };

    const poliza = {
      id:                  idPoliza,
      numeroPoliza:        dto.numeroPoliza || RegistroService._numeroPolizaAuto(),
      plan:                dto.plan || 'Plan Estándar',
      porcentajeCobertura: dto.porcentajeCobertura,
      fechaInicio,
      fechaFin,
      estado:              dto.estado || 'VIGENTE',
    };

    await this.repo.crearAseguradoConPoliza(asegurado, poliza);
    aseguradosRegistradosCounter.inc();

    return {
      idAsegurado:     asegurado.id,
      nombre:          asegurado.nombre,
      apellido:        asegurado.apellido,
      tipoDocumento:   asegurado.tipoDocumento,
      numeroDocumento: asegurado.numeroDocumento,
      poliza: {
        idPoliza:            poliza.id,
        numeroPoliza:        poliza.numeroPoliza,
        plan:                poliza.plan,
        porcentajeCobertura: poliza.porcentajeCobertura,
        estado:              poliza.estado,
        vigencia: { fechaInicio: poliza.fechaInicio, fechaFin: poliza.fechaFin },
      },
    };
  }

  /** Genera un número de póliza único legible: POL-<año>-<6 hex>. */
  static _numeroPolizaAuto() {
    const anio = new Date().getFullYear();
    const sufijo = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    return `POL-${anio}-${sufijo}`;
  }

  /** Suma un año a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. */
  static _sumarUnAnio(fecha) {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
}

module.exports = RegistroService;
