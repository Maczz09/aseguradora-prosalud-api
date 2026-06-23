'use strict';

const pool = require('../config/database');

class OutboxRepository {
  /**
   * Inserta un evento en la tabla outbox.
   * Es un INSERT simple y rápido — no bloquea la respuesta HTTP.
   *
   * @param {{ id: string, evento: string, payload: object }} evento
   */
  async insertar({ id, evento, payload }) {
    await pool.execute(
      `INSERT INTO outbox (id, evento, payload, publicado, intentos)
       VALUES (?, ?, ?, 0, 0)`,
      [id, evento, JSON.stringify(payload)],
    );
  }
}

module.exports = OutboxRepository;
