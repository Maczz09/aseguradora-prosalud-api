'use strict';

const { DomainError } = require('../domain/errors');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const detalles = result.error.issues.map((i) => ({
        campo: i.path.join('.') || '(raíz)',
        mensaje: i.message,
      }));
      return next(new DomainError('VALIDACION_FALLIDA', 400, 'Uno o más campos son inválidos.', detalles));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = { validate };
