// Consultas del Dominio 6 (estado temporal del repartidor) en Redis.
// Responsable: Liliana Averos
//
// Convención de claves (database/redis/README.md):
//   repartidor:REP-001:ubicacion  → JSON { x, y, codigo_envio, registrada_en }   TTL 90 s
//   repartidor:REP-001:conexion   → JSON { estado, actualizado_en }               TTL 90 s
// Todas las claves se escriben con expiración (SET … EX): Redis las borra solas cuando el
// repartidor deja de reportar. Nada de esto es fuente oficial ni prueba de entrega.
const { cliente } = require('../../db/redis');
const { pool } = require('../../db/postgres');

const TTL_SEGUNDOS = Object.freeze({ ubicacion: 90, conexion: 90 });
const TIPOS = Object.keys(TTL_SEGUNDOS);

const clave = (repartidor, tipo) => `repartidor:${repartidor}:${tipo}`;

function disponible() {
  return cliente.isReady;
}

async function guardar(repartidor, tipo, valor) {
  await cliente.set(clave(repartidor, tipo), JSON.stringify(valor), { EX: TTL_SEGUNDOS[tipo] });
}

function interpretar(texto, ttl) {
  if (texto === null || ttl < 0) return null;
  try {
    return { valor: JSON.parse(texto), ttl };
  } catch {
    return null;
  }
}

/** Lee ubicación y conexión de varios repartidores en una sola ida a Redis. */
async function leerVarios(repartidores) {
  if (repartidores.length === 0) return new Map();
  const lote = cliente.multi();
  for (const r of repartidores) {
    for (const tipo of TIPOS) lote.get(clave(r, tipo)).ttl(clave(r, tipo));
  }
  const respuestas = await lote.exec();
  const resultado = new Map();
  let i = 0;
  for (const r of repartidores) {
    const estado = {};
    for (const tipo of TIPOS) {
      estado[tipo] = interpretar(respuestas[i], respuestas[i + 1]);
      i += 2;
    }
    resultado.set(r, estado);
  }
  return resultado;
}

async function leer(repartidor) {
  return (await leerVarios([repartidor])).get(repartidor);
}

/** "Marcar dato no vigente": se borran las claves antes de que expiren solas. */
async function borrar(repartidor, tipos = TIPOS) {
  return cliente.del(tipos.map((t) => clave(repartidor, t)));
}

// ---------- PostgreSQL (solo lectura) ----------

async function buscarRepartidor(codigo) {
  const { rows } = await pool.query(
    `SELECT r.codigo, r.nombre, r.activo, z.codigo AS zona_codigo, z.nombre AS zona_nombre
       FROM repartidores r JOIN zonas z ON z.id = r.zona_id WHERE r.codigo = $1`,
    [codigo],
  );
  return rows[0] || null;
}

async function listarRepartidores() {
  const { rows } = await pool.query(
    `SELECT r.codigo, r.nombre, r.activo, z.codigo AS zona_codigo, z.nombre AS zona_nombre
       FROM repartidores r JOIN zonas z ON z.id = r.zona_id ORDER BY r.codigo`,
  );
  return rows;
}

module.exports = { TTL_SEGUNDOS, TIPOS, clave, disponible, guardar, leer, leerVarios, borrar, buscarRepartidor, listarRepartidores };
