// Pool único de conexiones a PostgreSQL, compartido por todos los módulos.
const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  ...env.postgres,
  max: 10,
  connectionTimeoutMillis: env.tiempoMaximoSalud,
});

// Un error en una conexión inactiva no debe tumbar la API.
pool.on('error', (error) => {
  console.error('[postgres] error en conexión inactiva:', error.message);
});

async function verificar() {
  await pool.query('SELECT 1');
}

/**
 * Ejecuta fn(cliente) dentro de una transacción local de PostgreSQL.
 * Si fn termina bien se hace COMMIT; si lanza un error, ROLLBACK y se relanza.
 * Uso: await conTransaccion(async (cliente) => { await cliente.query(...); });
 */
async function conTransaccion(fn) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function cerrar() {
  await pool.end();
}

module.exports = { pool, verificar, conTransaccion, cerrar };
