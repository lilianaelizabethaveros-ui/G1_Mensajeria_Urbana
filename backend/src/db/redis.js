// Cliente único de Redis. Si Redis cae, reintenta conectar cada 2 s sin detener la API.
const { createClient } = require('redis');
const env = require('../config/env');

const cliente = createClient({
  socket: {
    host: env.redis.host,
    port: env.redis.port,
    connectTimeout: env.tiempoMaximoSalud,
    reconnectStrategy: () => 2000,
  },
  password: env.redis.password,
});

let ultimoError = '';
cliente.on('error', (error) => {
  // Se registra una sola vez por tipo de error para no llenar los logs.
  if (error.message !== ultimoError) {
    ultimoError = error.message;
    console.error('[redis] error:', error.message);
  }
});
cliente.on('ready', () => {
  ultimoError = '';
  console.log('[redis] conectado');
});

async function conectar() {
  await cliente.connect();
}

async function verificar() {
  if (!cliente.isReady) throw new Error('sin conexión');
  const respuesta = await cliente.ping();
  if (respuesta !== 'PONG') throw new Error(`respuesta inesperada: ${respuesta}`);
}

async function cerrar() {
  if (cliente.isOpen) await cliente.quit();
}

module.exports = { cliente, conectar, verificar, cerrar };
