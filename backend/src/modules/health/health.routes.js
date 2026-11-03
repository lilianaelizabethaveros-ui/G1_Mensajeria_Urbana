// GET /health: comprueba la API y cada gestor sin exponer credenciales.
// 200 si los tres responden; 503 si alguno falla (la API sigue atendiendo).
// Incluye el estado de la outbox (eventos pendientes de sincronizar a MongoDB)
// y de las migraciones de PostgreSQL.
const { Router } = require('express');
const env = require('../../config/env');
const postgres = require('../../db/postgres');
const mongo = require('../../db/mongo');
const redis = require('../../db/redis');
const migraciones = require('../../db/migrar');
const outbox = require('../../shared/outbox');

const router = Router();

function conLimiteDeTiempo(promesa, ms) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

async function comprobar(verificar) {
  const inicio = Date.now();
  try {
    await conLimiteDeTiempo(verificar(), env.tiempoMaximoSalud);
    return { estado: 'ok', ms: Date.now() - inicio };
  } catch (error) {
    return { estado: 'caido', ms: Date.now() - inicio, error: error.message };
  }
}

// Si la consulta falla (por ejemplo, la tabla aún no existe) se informa null.
async function opcional(consulta) {
  try {
    return await conLimiteDeTiempo(consulta(), env.tiempoMaximoSalud);
  } catch {
    return null;
  }
}

router.get('/', async (req, res) => {
  const [pg, mg, rd] = await Promise.all([
    comprobar(postgres.verificar),
    comprobar(mongo.verificar),
    comprobar(redis.verificar),
  ]);
  const gestores = { postgres: pg, mongo: mg, redis: rd };
  const todosOk = Object.values(gestores).every((g) => g.estado === 'ok');

  const pgOk = pg.estado === 'ok';
  const [estadoOutbox, estadoMigraciones] = await Promise.all([
    pgOk ? opcional(() => outbox.resumen(postgres.pool)) : null,
    pgOk ? opcional(() => migraciones.estado()) : null,
  ]);

  res.status(todosOk ? 200 : 503).json({
    ok: todosOk,
    datos: {
      api: 'ok',
      gestores,
      outbox: estadoOutbox,
      migraciones: estadoMigraciones,
      fecha: new Date().toISOString(),
    },
  });
});

module.exports = router;
