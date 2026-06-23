'use strict';

/**
 * Middleware de Backpressure / Bulkhead.
 *
 * Semáforo en memoria: si ya hay MAX_SOLICITUDES_CONCURRENTES solicitudes en
 * vuelo, las nuevas se rechazan inmediatamente con 503 SERVICIO_SATURADO.
 *
 * ¿Por qué rechazar en vez de encolar?
 * Una cola interna ilimitada solo retrasa el colapso — acumula memoria y hace
 * lentas TODAS las respuestas, incluso las legítimas. Rechazar rápido con 503
 * mantiene rápidas las solicitudes aceptadas y da una señal honesta al cliente
 * (MediCitas) para que su lógica de Retry+Jitter decida cuándo volver a intentar.
 *
 * Catálogo de errores: SERVICIO_SATURADO | 503
 */

const MAX_CONCURRENTES = parseInt(process.env.MAX_SOLICITUDES_CONCURRENTES || '50');
let enCurso = 0;

function backpressureMiddleware(req, res, next) {
  if (enCurso >= MAX_CONCURRENTES) {
    return res.status(503).json({
      codigo:  'SERVICIO_SATURADO',
      mensaje: `Demasiadas solicitudes simultáneas (límite: ${MAX_CONCURRENTES}). Intente nuevamente en unos segundos.`,
    });
  }

  enCurso++;

  // Decrementar cuando la respuesta termine — cubre tanto respuestas exitosas
  // como cortes de conexión del cliente antes de recibir la respuesta.
  res.on('finish', () => { enCurso = Math.max(0, enCurso - 1); });
  res.on('close',  () => { enCurso = Math.max(0, enCurso - 1); });

  next();
}

module.exports = backpressureMiddleware;
