'use strict';

/**
 * Logger estructurado (pino) para aseguradora-prosalud-api.
 *
 * - Con LOKI_HOST definido → envía JSON a Loki (visible en Grafana, etiqueta
 *   `app: aseguradora-api`).
 * - Sin LOKI_HOST → salida legible en consola (pino-pretty) para desarrollo.
 *
 * Acepta dos estilos de llamada:
 *   logger.info({ campo: valor }, 'mensaje')   ← estilo pino
 *   logger.info('mensaje', extra1, extra2)     ← estilo console.log (migración)
 */

const pino = require('pino');

// CRÍTICO: si Loki se cae, el log no debe depender exclusivamente de él — con
// un solo target, un lote fallido se pierde en silencio y esas líneas jamás
// aparecen ni en Grafana ni en `docker logs`. Con `targets`, stdout y Loki
// corren en paralelo e independientes.
const transport = process.env.LOKI_HOST
  ? pino.transport({
      targets: [
        { target: 'pino-pretty', level: process.env.LOG_LEVEL || 'info',
          options: { colorize: true, translateTime: 'SYS:standard' } },
        { target: 'pino-loki', level: process.env.LOG_LEVEL || 'info',
          options: {
            batching: true,
            interval: 5,
            host: process.env.LOKI_HOST,
            labels: { app: process.env.LOKI_APP_LABEL || 'aseguradora-api' },
          } },
      ],
    })
  : pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    });

const pinoLogger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    formatters: { level: (label) => ({ level: label.toUpperCase() }) },
    // pino-loki requiere `time` numérico (epoch ms); con isoTime genera NaN
    // y Loki rechaza los lotes completos.
    timestamp: process.env.LOKI_HOST ? pino.stdTimeFunctions.epochTime : pino.stdTimeFunctions.isoTime,
  },
  transport,
);

function aTexto(valor) {
  if (typeof valor === 'string') return valor;
  if (valor instanceof Error) return valor.stack || valor.message;
  try { return JSON.stringify(valor); } catch { return String(valor); }
}

function llamar(nivel, ...args) {
  // Estilo pino: (objeto, mensaje)
  if (args.length >= 2 && typeof args[0] === 'object' && args[0] !== null && typeof args[1] === 'string') {
    pinoLogger[nivel](args[0], args[1]);
    return;
  }
  // Estilo console: concatenar todos los argumentos en un mensaje
  pinoLogger[nivel](args.map(aTexto).join(' '));
}

module.exports = {
  info:  (...args) => llamar('info', ...args),
  warn:  (...args) => llamar('warn', ...args),
  error: (...args) => llamar('error', ...args),
  debug: (...args) => llamar('debug', ...args),
};
