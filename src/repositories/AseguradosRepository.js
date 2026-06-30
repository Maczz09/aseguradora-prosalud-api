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

  /**
   * Crea un asegurado junto con su póliza en una sola transacción.
   * Si cualquiera de los dos INSERT falla, se revierte todo (atomicidad).
   *
   * @param {object} asegurado — { id, nombre, apellido, tipoDocumento, numeroDocumento, fechaNacimiento }
   * @param {object} poliza    — { id, numeroPoliza, plan, porcentajeCobertura, fechaInicio, fechaFin, estado }
   */
  async crearAseguradoConPoliza(asegurado, poliza) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `INSERT INTO asegurados
           (id_asegurado, nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, activo)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          asegurado.id,
          asegurado.nombre,
          asegurado.apellido,
          asegurado.tipoDocumento,
          asegurado.numeroDocumento,
          asegurado.fechaNacimiento ?? null,
        ],
      );

      await conn.execute(
        `INSERT INTO polizas
           (id_poliza, id_asegurado, numero_poliza, plan, porcentaje_cobertura, fecha_inicio, fecha_fin, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          poliza.id,
          asegurado.id,
          poliza.numeroPoliza,
          poliza.plan,
          poliza.porcentajeCobertura,
          poliza.fechaInicio,
          poliza.fechaFin,
          poliza.estado,
        ],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = AseguradosRepository;
