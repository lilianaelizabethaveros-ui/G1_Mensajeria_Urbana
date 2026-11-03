// Aplicador de migraciones SQL (decisión D14). Se ejecuta al arrancar la API.
//
// - Lee database/postgres/migrations/NNN_descripcion.sql
// - Registra lo aplicado en schema_migrations(version, nombre, hash, aplicada_en)
// - Aplica los pendientes en orden numérico, cada uno en su propia transacción
// - Si una migración falla se revierte y la API no arranca (el error sale en los logs)
// - Avisa si alguien modificó un archivo que ya estaba aplicado
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pool } = require('./postgres');

const CARPETA = process.env.MIGRACIONES_DIR
  || path.join(__dirname, '..', '..', 'database', 'postgres', 'migrations');
const PATRON = /^(\d{3})_[a-z0-9_]+\.sql$/;
// Número fijo para pg_advisory_lock: evita que dos procesos migren a la vez.
const LLAVE_BLOQUEO = 482_001;

function hashDe(contenido) {
  return createHash('sha256').update(contenido.replace(/\r\n/g, '\n')).digest('hex');
}

async function leerArchivos() {
  const nombres = (await fs.readdir(CARPETA)).sort();
  const migraciones = [];
  const vistas = new Map();

  for (const nombre of nombres) {
    if (!nombre.endsWith('.sql')) continue;
    const coincide = PATRON.exec(nombre);
    if (!coincide) {
      throw new Error(`Nombre de migración inválido: ${nombre}. Formato esperado: NNN_descripcion.sql (minúsculas y _)`);
    }
    const version = Number(coincide[1]);
    if (vistas.has(version)) {
      throw new Error(`Dos migraciones usan el número ${coincide[1]}: ${vistas.get(version)} y ${nombre}`);
    }
    vistas.set(version, nombre);
    const sql = await fs.readFile(path.join(CARPETA, nombre), 'utf8');
    migraciones.push({ version, nombre, sql, hash: hashDe(sql) });
  }
  return migraciones;
}

async function migrar() {
  const migraciones = await leerArchivos();
  const cliente = await pool.connect();
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [LLAVE_BLOQUEO]);
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     integer PRIMARY KEY,
        nombre      text        NOT NULL,
        hash        char(64)    NOT NULL,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await cliente.query('SELECT version, nombre, hash FROM schema_migrations');
    const aplicadas = new Map(rows.map((r) => [r.version, r]));
    let nuevas = 0;

    for (const m of migraciones) {
      const previa = aplicadas.get(m.version);
      if (previa) {
        if (previa.hash.trim() !== m.hash) {
          console.warn(`[migraciones] ATENCIÓN: ${m.nombre} cambió después de aplicarse. `
            + 'No se vuelve a ejecutar: crea una migración nueva para corregirla.');
        }
        continue;
      }
      try {
        await cliente.query('BEGIN');
        await cliente.query(m.sql);
        await cliente.query(
          'INSERT INTO schema_migrations (version, nombre, hash) VALUES ($1, $2, $3)',
          [m.version, m.nombre, m.hash],
        );
        await cliente.query('COMMIT');
        nuevas += 1;
        console.log(`[migraciones] aplicada ${m.nombre}`);
      } catch (error) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw new Error(`Falló la migración ${m.nombre}: ${error.message}`);
      }
    }

    console.log(`[migraciones] ${nuevas} nuevas, ${migraciones.length} en total`);
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [LLAVE_BLOQUEO]).catch(() => {});
    cliente.release();
  }
}

/** Para /health: última versión aplicada y cantidad. */
async function estado() {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS aplicadas, max(version) AS ultima FROM schema_migrations',
  );
  return rows[0];
}

module.exports = { migrar, estado, CARPETA };
