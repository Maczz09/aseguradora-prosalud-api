'use strict';

const { randomUUID } = require('crypto');
const pool = require('../config/database');

// Backoff exponencial con techo — evita reintentos cada segundo contra un
// MediCitas caído por horas, pero sigue insistiendo indefinidamente hasta
// MAX_INTENTOS (luego pasa a FALLIDO_PERMANENTE para revisión manual del
// responsable, sin perder el registro ni bloquear al worker).
const BASE_MS = 30_000;      // 30s
const TECHO_MS = 3_600_000;  // 1h
const MAX_INTENTOS = 20;

function calcularProximoIntento(intentos) {
  const ms = Math.min(BASE_MS * 2 ** intentos, TECHO_MS);
  return new Date(Date.now() + ms);
}

class WebhooksSalientesRepository {
  async encolar({ tipoEvento, payload, urlDestino }) {
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO webhooks_salientes (id, tipo_evento, payload, url_destino)
       VALUES (?, ?, ?, ?)`,
      [id, tipoEvento, JSON.stringify(payload), urlDestino]
    );
    return id;
  }

  async obtenerPendientes(limit = 20) {
    const [rows] = await pool.query(
      `SELECT * FROM webhooks_salientes
       WHERE estado = 'PENDIENTE' AND proximo_intento_en <= NOW()
       ORDER BY created_at ASC
       LIMIT ${Number(limit)}`
    );
    return rows.map((r) => ({ ...r, payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload }));
  }

  async marcarEntregado(id) {
    await pool.execute(`UPDATE webhooks_salientes SET estado = 'ENTREGADO' WHERE id = ?`, [id]);
  }

  async marcarReintento(id, intentosPrevios, error) {
    const intentos = intentosPrevios + 1;
    if (intentos >= MAX_INTENTOS) {
      await pool.execute(
        `UPDATE webhooks_salientes SET estado = 'FALLIDO_PERMANENTE', intentos = ?, ultimo_error = ? WHERE id = ?`,
        [intentos, String(error).slice(0, 500), id]
      );
      return 'FALLIDO_PERMANENTE';
    }
    await pool.execute(
      `UPDATE webhooks_salientes SET intentos = ?, proximo_intento_en = ?, ultimo_error = ? WHERE id = ?`,
      [intentos, calcularProximoIntento(intentos), String(error).slice(0, 500), id]
    );
    return 'PENDIENTE';
  }

  async contarPendientes() {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM webhooks_salientes WHERE estado = 'PENDIENTE'`
    );
    return total;
  }
}

module.exports = WebhooksSalientesRepository;
