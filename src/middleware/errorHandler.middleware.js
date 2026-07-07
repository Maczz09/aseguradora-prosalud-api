'use strict';

const { DomainError } = require('../domain/errors');
const logger = require('../config/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let codigo = 'ERROR_INTERNO_ASEGURADORA';
  let mensaje = 'Error interno del servidor. Intente nuevamente.';
  let detalles;

  if (err instanceof DomainError) {
    status = err.status;
    codigo = err.codigo;
    mensaje = err.message;
    if (err.detalles) detalles = err.detalles;
  } else if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    status = 400;
    codigo = 'JSON_MALFORMADO';
    mensaje = 'El cuerpo de la petición no es un JSON válido.';
  } else if (err.status && Number.isInteger(err.status)) {
    status = err.status;
    codigo = err.codigo || codigo;
    mensaje = err.message || mensaje;
  }
  if (!Number.isInteger(status) || status < 100 || status > 599) status = 500;

  if (status >= 500) {
    logger.error({ codigo, err: err.message, stack: err.stack, ruta: req.originalUrl, metodo: req.method, correlationId: req.correlationId }, 'Error no controlado en la petición');
  } else {
    logger.warn({ codigo, mensaje, ruta: req.originalUrl, metodo: req.method, correlationId: req.correlationId }, 'Petición rechazada');
  }

  return res.status(status).json({
    codigo,
    mensaje,
    ...(detalles && { detalles }),
    correlationId: req.correlationId || null,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { errorHandler };
