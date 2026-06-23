'use strict';

const pool = require('../config/database');

class AseguradosRepository {
  /**
   * Busca un asegurado activo por tipo y número de documento.
   * @returns {object|null} Fila de la BD o null si no existe
   */
  async findByDocumento(tipoDocumento, numeroDocumento) {
    const [rows] = await pool.execute(
      `SELECT id_asegurado, nombre, apellido, tipo_documento, numero_documento
         FROM asegurados
        WHERE tipo_documento    = ?
          AND numero_documento  = ?
          AND activo            = 1
        LIMIT 1`,
      [tipoDocumento, numeroDocumento],
    );
    return rows[0] || null;
  }

  /**
   * Busca la póliza VIGENTE de un asegurado (estado = VIGENTE y fechas válidas).
   * Devuelve solo una — la primera que encuentre (ordenada por fecha_fin DESC).
   * @returns {object|null} Fila de la BD o null si no tiene póliza vigente
   */
  async findPolizaVigentePorAsegurado(idAsegurado) {
    const [rows] = await pool.execute(
      `SELECT id_poliza, id_asegurado, numero_poliza, plan,
              porcentaje_cobertura, fecha_inicio, fecha_fin, estado
         FROM polizas
        WHERE id_asegurado = ?
          AND estado       = 'VIGENTE'
          AND fecha_inicio <= CURDATE()
          AND fecha_fin    >= CURDATE()
        ORDER BY fecha_fin DESC
        LIMIT 1`,
      [idAsegurado],
    );
    return rows[0] || null;
  }
}

module.exports = AseguradosRepository;
