'use strict';

/**
 * Entidad de dominio Poliza.
 * Representa una póliza con su ciclo de vida y la capacidad de validar vigencia.
 */
class Poliza {
  /**
   * @param {object} row — Fila cruda de la tabla `polizas`
   */
  constructor(row) {
    this.idPoliza            = row.id_poliza;
    this.idAsegurado         = row.id_asegurado;
    this.numeroPoliza        = row.numero_poliza;
    this.plan                = row.plan;
    this.porcentajeCobertura = parseFloat(row.porcentaje_cobertura);
    this.fechaInicio         = new Date(row.fecha_inicio);
    this.fechaFin            = new Date(row.fecha_fin);
    this.estado              = row.estado; // 'VIGENTE' | 'VENCIDA' | 'SUSPENDIDA'
  }

  /**
   * Una póliza está vigente si:
   * 1. Su estado es 'VIGENTE'
   * 2. La fecha actual está dentro del rango [fechaInicio, fechaFin]
   */
  estaVigente() {
    const ahora = new Date();
    return (
      this.estado === 'VIGENTE' &&
      ahora >= this.fechaInicio &&
      ahora <= this.fechaFin
    );
  }

  /**
   * DTO de respuesta para el endpoint /validar
   */
  toDTO() {
    return {
      asegurado:           true,
      numeroPoliza:        this.numeroPoliza,
      plan:                this.plan,
      porcentajeCobertura: this.porcentajeCobertura,
      vigencia: {
        fechaInicio: this.fechaInicio.toISOString().split('T')[0],
        fechaFin:    this.fechaFin.toISOString().split('T')[0],
      },
    };
  }
}

module.exports = Poliza;
