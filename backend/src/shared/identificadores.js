// Identificadores compartidos entre gestores (decisión D7).
//   Envío:      ENV-XXXXXXXX  (8 caracteres sin letras ni números confusos)
//   Repartidor: REP-NNN       (lo crea el módulo de despacho)
const { randomInt } = require('node:crypto');

// Sin 0/O, 1/I/L: se dictan y se escriben sin confusión.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LARGO_CODIGO = 8;

const PATRON_CODIGO_ENVIO = new RegExp(`^ENV-[${ALFABETO}]{${LARGO_CODIGO}}$`);
const PATRON_CODIGO_REPARTIDOR = /^REP-\d{3}$/;

/** Genera un código aleatorio. La unicidad final la garantiza UNIQUE en PostgreSQL. */
function generarCodigoEnvio() {
  let codigo = 'ENV-';
  for (let i = 0; i < LARGO_CODIGO; i += 1) {
    codigo += ALFABETO[randomInt(ALFABETO.length)];
  }
  return codigo;
}

/** Acepta minúsculas y espacios alrededor: " env-7k3p9qxm " → "ENV-7K3P9QXM". */
function normalizarCodigo(valor) {
  return typeof valor === 'string' ? valor.trim().toUpperCase() : '';
}

function esCodigoEnvio(valor) {
  return PATRON_CODIGO_ENVIO.test(normalizarCodigo(valor));
}

function esCodigoRepartidor(valor) {
  return PATRON_CODIGO_REPARTIDOR.test(normalizarCodigo(valor));
}

module.exports = {
  ALFABETO,
  PATRON_CODIGO_ENVIO,
  PATRON_CODIGO_REPARTIDOR,
  generarCodigoEnvio,
  normalizarCodigo,
  esCodigoEnvio,
  esCodigoRepartidor,
};
