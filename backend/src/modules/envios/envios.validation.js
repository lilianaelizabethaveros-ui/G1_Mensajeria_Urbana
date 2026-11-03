// Esquemas de validación del Dominio 1. La API no confía en el navegador:
// todo se valida aquí, y los campos que no estén en el esquema se descartan
// (por ejemplo, un "estado" o un "precio" enviado desde el formulario).
const { validar } = require('../../shared/validacion');
const { errores } = require('../../shared/errores');
const { esCodigoEnvio, normalizarCodigo } = require('../../shared/identificadores');

const NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'. -]*$/u;
const TELEFONO = /^0\d{8,9}$/;
const CODIGO_CATALOGO = /^[A-Za-z0-9_]{2,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const nombre = {
  tipo: 'texto', requerido: true, min: 3, max: 80, patron: NOMBRE,
  mensajePatron: 'Solo letras, espacios, punto, apóstrofo o guion.',
};
const telefono = {
  tipo: 'texto', requerido: true, patron: TELEFONO,
  mensajePatron: 'Teléfono ficticio de 9 o 10 dígitos que empiece con 0 (sin espacios).',
};
const direccion = { tipo: 'texto', requerido: true, min: 5, max: 160 };
const codigoCatalogo = {
  tipo: 'texto', requerido: true, patron: CODIGO_CATALOGO, mensajePatron: 'Código de catálogo inválido.',
};

const ESQUEMA_SOLICITUD = {
  remitente_nombre: nombre,
  remitente_telefono: telefono,
  origen_direccion: direccion,
  origen_zona: codigoCatalogo,
  destinatario_nombre: nombre,
  destinatario_telefono: telefono,
  destino_direccion: direccion,
  destino_zona: codigoCatalogo,
  tipo_servicio: codigoCatalogo,
  descripcion: { tipo: 'texto', requerido: true, min: 3, max: 160 },
  peso_kg: { tipo: 'numero', requerido: true, min: 0.01, max: 9999 },
  observaciones: { tipo: 'texto', max: 300, porDefecto: '' },
};

const ESQUEMA_CANCELACION = {
  motivo: { tipo: 'texto', requerido: true, min: 5, max: 200 },
  actor: { tipo: 'opcion', opciones: ['CLIENTE', 'OPERADOR'], porDefecto: 'CLIENTE' },
};

function validarSolicitud(cuerpo) {
  const datos = validar(cuerpo, ESQUEMA_SOLICITUD);
  datos.origen_zona = datos.origen_zona.toUpperCase();
  datos.destino_zona = datos.destino_zona.toUpperCase();
  datos.tipo_servicio = datos.tipo_servicio.toUpperCase();
  datos.peso_kg = Math.round(datos.peso_kg * 100) / 100;
  return datos;
}

function validarCancelacion(cuerpo) {
  return validar(cuerpo ?? {}, ESQUEMA_CANCELACION);
}

/** Valida y normaliza el código de la URL (acepta minúsculas). */
function validarCodigo(valor) {
  if (!esCodigoEnvio(valor)) {
    throw errores.validacion(
      [{ campo: 'codigo', mensaje: 'El código debe tener el formato ENV-XXXXXXXX (8 letras o números).' }],
      'El código de envío no es válido.',
    );
  }
  return normalizarCodigo(valor);
}

/** Encabezado opcional Idempotency-Key: debe ser un UUID. */
function validarClaveIdempotencia(valor) {
  if (valor === undefined || valor === '') return null;
  if (!UUID.test(valor)) {
    throw errores.validacion(
      [{ campo: 'Idempotency-Key', mensaje: 'Debe ser un UUID, por ejemplo el que genera crypto.randomUUID().' }],
    );
  }
  return valor.toLowerCase();
}

module.exports = { validarSolicitud, validarCancelacion, validarCodigo, validarClaveIdempotencia };
