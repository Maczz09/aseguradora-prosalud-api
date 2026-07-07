'use strict';

const { randomUUID } = require('crypto');
const Poliza = require('../domain/Poliza');
const { validacionesCoberturaCounter } = require('../config/metrics');

class ValidacionService {
  /**
   * @param {AseguradosRepository} aseguradosRepository
   * @param {OutboxRepository}     outboxRepository
   */
  constructor(aseguradosRepository, outboxRepository) {
    this.repo       = aseguradosRepository;
    this.outboxRepo = outboxRepository;
  }

  /**
   * Valida si un documento tiene una póliza vigente.
   *
   * Flujo:
   * 1. Buscar asegurado activo por documento
   * 2. Si existe, buscar póliza vigente
   * 3. Insertar evento en outbox (auditoría asíncrona) ANTES de responder
   * 4. Retornar DTO
   *
   * @param {string} tipoDocumento   — DNI | CE | PASAPORTE
   * @param {string} numeroDocumento — Número del documento
   * @returns {object} DTO de respuesta
   */
  async validar(tipoDocumento, numeroDocumento) {
    const asegurado = await this.repo.findByDocumento(tipoDocumento, numeroDocumento);
    const polizaRow = asegurado
      ? await this.repo.findPolizaVigentePorAsegurado(asegurado.id_asegurado)
      : null;

    const poliza  = polizaRow ? new Poliza(polizaRow) : null;
    const vigente = poliza && poliza.estaVigente();

    validacionesCoberturaCounter.inc({ resultado: vigente ? 'aprobada' : 'rechazada' });

    // ── Auditoría asíncrona: INSERT en outbox (rápido, no bloquea) ──────────
    // El OutboxWorker leerá esto y publicará a RabbitMQ en segundo plano.
    await this.outboxRepo.insertar({
      id:     randomUUID(),
      evento: vigente ? 'PolizaValidada' : 'PolizaNoEncontrada',
      payload: {
        tipoDocumento,
        numeroDocumento,
        numeroPoliza:        vigente ? poliza.numeroPoliza        : null,
        porcentajeCobertura: vigente ? poliza.porcentajeCobertura : null,
      },
    });

    // ── Respuesta síncrona ───────────────────────────────────────────────────
    return vigente ? poliza.toDTO() : { asegurado: false };
  }
}

module.exports = ValidacionService;
