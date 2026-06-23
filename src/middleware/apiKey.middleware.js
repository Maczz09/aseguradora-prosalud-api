'use strict';

/**
 * Middleware de autenticación por API Key.
 *
 * Verifica que el header `X-Api-Key` coincida con la clave configurada.
 * Devuelve 401 si el header está ausente o es incorrecto.
 *
 * Catálogo de errores: API_KEY_INVALIDA | 401
 */
function apiKeyMiddleware(req, res, next) {
  const claveEnviada    = req.headers['x-api-key'];
  const claveConfigurada = process.env.ASEGURADORA_API_KEY;

  if (!claveEnviada || claveEnviada !== claveConfigurada) {
    return res.status(401).json({
      codigo:  'API_KEY_INVALIDA',
      mensaje: 'API Key ausente o inválida. Incluya el header X-Api-Key con la clave correcta.',
    });
  }

  next();
}

module.exports = apiKeyMiddleware;
