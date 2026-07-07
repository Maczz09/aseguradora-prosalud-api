'use strict';

const { z } = require('zod');

const TIPOS_VALIDOS   = ['DNI', 'CE', 'PASAPORTE'];
const ESTADOS_VALIDOS = ['VIGENTE', 'VENCIDA', 'SUSPENDIDA'];
const FECHA_REGEX     = /^\d{4}-\d{2}-\d{2}$/;

// Reglas de formato del número de documento, por tipo (idénticas a las que
// tenía el controlador antes de migrar a Zod).
const REGLAS_DOCUMENTO = {
  DNI:       { regex: /^\d{8}$/,             mensaje: 'El DNI debe tener exactamente 8 dígitos.' },
  CE:        { regex: /^[A-Za-z0-9]{6,12}$/, mensaje: 'El CE debe ser alfanumérico de 6 a 12 caracteres.' },
  PASAPORTE: { regex: /^[A-Za-z0-9]{6,12}$/, mensaje: 'El pasaporte debe ser alfanumérico de 6 a 12 caracteres.' },
};

const fechaOpcional = (campo) => z.string().trim()
  .regex(FECHA_REGEX, `${campo} debe tener formato YYYY-MM-DD.`)
  .optional()
  .or(z.literal('').transform(() => undefined));

// GET /asegurados/validar?tipoDocumento=&numeroDocumento=
const validarQuerySchema = z.object({
  tipoDocumento: z.string({ error: 'tipoDocumento es obligatorio' })
    .trim().min(1, 'tipoDocumento es obligatorio')
    .transform((v) => v.toUpperCase())
    .refine((v) => TIPOS_VALIDOS.includes(v), { message: `tipoDocumento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` }),
  numeroDocumento: z.string({ error: 'numeroDocumento es obligatorio' })
    .trim().min(1, 'numeroDocumento es obligatorio'),
});

// POST /asegurados
const crearAseguradoSchema = z.object({
  nombre: z.string({ error: 'nombre es obligatorio' }).trim().min(1, 'nombre es obligatorio.'),
  apellido: z.string({ error: 'apellido es obligatorio' }).trim().min(1, 'apellido es obligatorio.'),
  tipoDocumento: z.string({ error: 'tipoDocumento es obligatorio' })
    .trim().transform((v) => v.toUpperCase())
    .refine((v) => TIPOS_VALIDOS.includes(v), { message: `tipoDocumento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}.` }),
  numeroDocumento: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
  porcentajeCobertura: z.coerce.number({ error: 'porcentajeCobertura debe ser un número entre 0 y 100.' })
    .min(0, 'porcentajeCobertura debe ser un número entre 0 y 100.')
    .max(100, 'porcentajeCobertura debe ser un número entre 0 y 100.'),
  fechaNacimiento: fechaOpcional('fechaNacimiento'),
  plan: z.string().trim().min(1).optional(),
  numeroPoliza: z.string().trim().min(1).optional(),
  fechaInicio: fechaOpcional('fechaInicio'),
  fechaFin: fechaOpcional('fechaFin'),
  estado: z.string().trim().transform((v) => v.toUpperCase()).optional().default('VIGENTE')
    .refine((v) => ESTADOS_VALIDOS.includes(v), { message: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.` }),
}).superRefine((data, ctx) => {
  const regla = REGLAS_DOCUMENTO[data.tipoDocumento];
  if (regla && !regla.regex.test(data.numeroDocumento)) {
    ctx.addIssue({ code: 'custom', path: ['numeroDocumento'], message: regla.mensaje });
  }
});

// PATCH /asegurados/poliza/:numeroPoliza/estado
const actualizarEstadoSchema = z.object({
  estado: z.string({ error: 'estado es obligatorio' })
    .trim().transform((v) => v.toUpperCase())
    .refine((v) => ESTADOS_VALIDOS.includes(v), { message: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.` }),
});

module.exports = { validarQuerySchema, crearAseguradoSchema, actualizarEstadoSchema };
