'use strict';

class DomainError extends Error {
  constructor(codigo, status, mensaje, detalles) {
    super(mensaje);
    this.name = 'DomainError';
    this.codigo = codigo;
    this.status = status;
    if (detalles) this.detalles = detalles;
  }
}

module.exports = { DomainError };
