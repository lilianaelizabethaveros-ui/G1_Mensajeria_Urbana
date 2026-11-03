// Máquina de estados del envío: CONTRATO COMPARTIDO por los tres integrantes.
// Ningún módulo debe cambiar un estado sin pasar por validarTransicion().
// Las transiciones concretas son la PROPUESTA P1 (pendiente de acuerdo del equipo):
// si el equipo las cambia, se modifican solo aquí, en un Pull Request avisado.
const { errores } = require('./errores');

const ESTADOS = Object.freeze({
  CREADO: 'CREADO',
  ACEPTADO: 'ACEPTADO',
  ASIGNADO: 'ASIGNADO',
  RETIRADO: 'RETIRADO',
  EN_TRANSITO: 'EN_TRANSITO',
  INCIDENCIA: 'INCIDENCIA',
  ENTREGADO: 'ENTREGADO',
  CANCELADO: 'CANCELADO',
});

const E = ESTADOS;
const TRANSICIONES = Object.freeze({
  [E.CREADO]: [E.ACEPTADO, E.CANCELADO],
  [E.ACEPTADO]: [E.ASIGNADO, E.CANCELADO],
  [E.ASIGNADO]: [E.RETIRADO, E.ACEPTADO],
  [E.RETIRADO]: [E.EN_TRANSITO, E.INCIDENCIA],
  [E.EN_TRANSITO]: [E.ENTREGADO, E.INCIDENCIA],
  [E.INCIDENCIA]: [E.EN_TRANSITO, E.CANCELADO],
  [E.ENTREGADO]: [],
  [E.CANCELADO]: [],
});

const ESTADO_INICIAL = E.CREADO;
const ESTADOS_FINALES = Object.freeze([E.ENTREGADO, E.CANCELADO]);

function esEstadoValido(estado) {
  return Object.prototype.hasOwnProperty.call(TRANSICIONES, estado);
}

function esTransicionValida(desde, hacia) {
  return esEstadoValido(desde) && TRANSICIONES[desde].includes(hacia);
}

/** Lanza un error 409 si la transición no está permitida. */
function validarTransicion(desde, hacia) {
  if (!esEstadoValido(hacia)) {
    throw errores.validacion([{ campo: 'estado', mensaje: `El estado ${hacia} no existe.` }]);
  }
  if (!esTransicionValida(desde, hacia)) {
    const permitidos = esEstadoValido(desde) ? TRANSICIONES[desde] : [];
    const sugerencia = permitidos.length
      ? ` Desde ${desde} solo se permite: ${permitidos.join(', ')}.`
      : ` ${desde} es un estado final.`;
    throw errores.conflicto('TRANSICION_INVALIDA', `No se puede pasar de ${desde} a ${hacia}.${sugerencia}`);
  }
}

module.exports = {
  ESTADOS,
  TRANSICIONES,
  ESTADO_INICIAL,
  ESTADOS_FINALES,
  esEstadoValido,
  esTransicionValida,
  validarTransicion,
};
