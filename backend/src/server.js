// Punto de entrada: aplica migraciones, abre las conexiones y arranca el servidor HTTP.
let env, app, postgres, mongo, redis, migrar;
try {
  env = require('./config/env');
  app = require('./app');
  postgres = require('./db/postgres');
  mongo = require('./db/mongo');
  redis = require('./db/redis');
  ({ migrar } = require('./db/migrar'));
} catch (error) {
  // Por ejemplo, una variable de entorno obligatoria que falta.
  console.error('[api] configuración inválida:', error.message);
  process.exit(1);
}

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));
const CODIGOS_SIN_CONEXION = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', '57P03']);

// Si PostgreSQL todavía no acepta conexiones, se reintenta cada 5 s.
// Un error en el SQL de una migración NO se reintenta: detiene el arranque.
async function migrarConReintentos() {
  for (let intento = 1; ; intento += 1) {
    try {
      await migrar();
      return;
    } catch (error) {
      const sinConexion = CODIGOS_SIN_CONEXION.has(error.code) || /timeout/i.test(error.message);
      if (!sinConexion) throw error;
      console.error(`[postgres] no disponible (intento ${intento}): ${error.message}. Reintento en 5 s...`);
      await esperar(5000);
    }
  }
}

async function iniciar() {
  // 1. PostgreSQL es la fuente oficial: primero se aplican las migraciones
  //    pendientes. Si una falla, la API no arranca (decisión D14).
  await migrarConReintentos();
  console.log('[postgres] conectado');

  // 2. MongoDB y Redis se conectan sin bloquear el arranque: si no están
  //    disponibles, la API funciona igual y /health lo informa.
  mongo.conectar()
    .then(() => console.log('[mongo] conectado'))
    .catch((e) => console.error('[mongo] no disponible al arrancar:', e.message));
  redis.conectar()
    .catch((e) => console.error('[redis] no disponible al arrancar:', e.message));

  const servidor = app.listen(env.puerto, () => {
    console.log(`[api] escuchando en el puerto ${env.puerto} (${env.nodeEnv})`);
  });

  // Cierre ordenado: "docker compose stop" envía SIGTERM.
  async function detener(senal) {
    console.log(`[api] ${senal} recibido, cerrando conexiones...`);
    servidor.close();
    await Promise.allSettled([postgres.cerrar(), mongo.cerrar(), redis.cerrar()]);
    process.exit(0);
  }
  process.on('SIGTERM', () => detener('SIGTERM'));
  process.on('SIGINT', () => detener('SIGINT'));
}

iniciar().catch((error) => {
  console.error('[api] error fatal al iniciar:', error.message);
  console.error('[api] corrige el problema y ejecuta: docker compose restart api');
  process.exit(1);
});
