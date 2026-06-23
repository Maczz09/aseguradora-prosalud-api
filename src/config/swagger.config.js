'use strict';

const swaggerJsdoc = require('swagger-jsdoc');

const opciones = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'API Aseguradora ProSalud',
      version:     '2.0.0',
      description: 'API de validación de cobertura de seguros — integración con MediCitas.\n\n' +
                   'Todos los endpoints requieren el header **X-Api-Key** con la clave compartida.',
      contact: {
        name: 'Equipo ProSalud',
      },
    },
    servers: [
      { url: '/api/v1', description: 'Servidor API v1' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in:   'header',
          name: 'X-Api-Key',
          description: 'Clave de API compartida con sistemas autorizados (ej: MediCitas).',
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    tags: [
      {
        name:        'Asegurados',
        description: 'Validación de cobertura y consulta de pólizas',
      },
    ],
  },
  apis: ['./src/routes/*.routes.js'],
};

module.exports = swaggerJsdoc(opciones);
