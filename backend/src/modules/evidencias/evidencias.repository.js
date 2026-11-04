// Consultas del Dominio 4 (evidencias de entrega).
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
//
// MongoDB, colección "evidencias": un documento por prueba de entrega, con _id = clave_evidencia
// (UUID que genera el navegador). Los datos son heterogéneos: según quién recibe cambian los
// campos del receptor, y la foto puede ser una URL simulada o una referencia interna.
// La confirmación oficial de la entrega está en PostgreSQL (envios.evidencia_id).
const { pool } = require('../../db/postgres');
const { db } = require('../../db/mongo');

const evidencias = db.collection('evidencias');

// Validación mínima en el propio MongoDB (además de la de la API): los campos comunes
// son obligatorios y el resto puede variar entre documentos.
const ESQUEMA = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['_id', 'codigo_envio', 'repartidor', 'receptor', 'foto', 'registrada_en'],
    properties: {
      _id: { bsonType: 'string', description: 'clave_evidencia (UUID)' },
      codigo_envio: { bsonType: 'string', pattern: '^ENV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$' },
      repartidor: { bsonType: 'string', pattern: '^REP-[0-9]{3}$' },
      receptor: {
        bsonType: 'object',
        required: ['tipo', 'nombre'],
        properties: {
          tipo: { enum: ['DESTINATARIO', 'FAMILIAR', 'VECINO', 'PORTERIA', 'OTRO'] },
          nombre: { bsonType: 'string' },
        },
      },
      foto: {
        bsonType: 'object',
        required: ['tipo', 'valor'],
        properties: { tipo: { enum: ['URL', 'REFERENCIA'] }, valor: { bsonType: 'string' } },
      },
      registrada_en: { bsonType: 'date' },
    },
  },
};

/** Crea la colección con su validador e índices. Se puede llamar muchas veces. */
async function asegurarColeccion() {
  const existentes = await db.listCollections({ name: 'evidencias' }, { nameOnly: true }).toArray();
  if (existentes.length === 0) {
    await db.createCollection('evidencias', { validator: ESQUEMA, validationLevel: 'moderate' })
      .catch((error) => { if (error.codeName !== 'NamespaceExists') throw error; });
  } else {
    await db.command({ collMod: 'evidencias', validator: ESQUEMA, validationLevel: 'moderate' });
  }
  await evidencias.createIndex({ codigo_envio: 1, registrada_en: -1 }, { name: 'evidencias_envio_fecha' });
  await evidencias.createIndex({ registrada_en: 1 }, { name: 'evidencias_fecha' });
}

async function insertar(documento) {
  await evidencias.insertOne(documento);
}

async function buscarPorClave(clave) {
  return evidencias.findOne({ _id: clave });
}

async function listarPorEnvio(codigo) {
  return evidencias.find({ codigo_envio: codigo }).sort({ registrada_en: -1 }).toArray();
}

/** Evidencias guardadas hace más de `minutos` (candidatas a huérfanas). */
async function listarAnterioresA(fecha) {
  return evidencias.find({ registrada_en: { $lt: fecha } }).sort({ registrada_en: 1 }).limit(500).toArray();
}

// ---------- PostgreSQL ----------

/** Envío con su estado vigente y la asignación activa (si la hay). */
async function buscarEnvioConAsignacion(codigo, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT e.id, e.codigo, e.estado, e.evidencia_id, e.entregado_en,
            a.id AS asignacion_id, r.codigo AS repartidor_codigo
       FROM envios e
       LEFT JOIN asignaciones a ON a.codigo_envio = e.codigo AND a.liberada_en IS NULL
       LEFT JOIN repartidores r ON r.id = a.repartidor_id
      WHERE e.codigo = $1`,
    [codigo],
  );
  return rows[0] || null;
}

/** Igual que el anterior, pero bloqueando la fila del envío (dentro de una transacción). */
async function bloquearEnvioConAsignacion(cliente, codigo) {
  const { rows } = await cliente.query('SELECT id FROM envios WHERE codigo = $1 FOR UPDATE', [codigo]);
  if (!rows[0]) return null;
  return buscarEnvioConAsignacion(codigo, cliente);
}

async function marcarEntregado(cliente, id, evidenciaId) {
  await cliente.query(
    `UPDATE envios SET estado = 'ENTREGADO', evidencia_id = $2, entregado_en = now(), actualizado_en = now()
      WHERE id = $1`,
    [id, evidenciaId],
  );
}

async function liberarAsignacion(cliente, asignacionId) {
  await cliente.query('UPDATE asignaciones SET liberada_en = now() WHERE id = $1 AND liberada_en IS NULL', [asignacionId]);
}

/** De una lista de claves, cuáles ya están referenciadas por un envío ENTREGADO. */
async function clavesConfirmadas(claves) {
  if (claves.length === 0) return new Set();
  const { rows } = await pool.query(
    `SELECT evidencia_id::text AS id FROM envios WHERE estado = 'ENTREGADO' AND evidencia_id = ANY($1::uuid[])`,
    [claves],
  );
  return new Set(rows.map((f) => f.id));
}

module.exports = {
  evidencias,
  asegurarColeccion,
  insertar,
  buscarPorClave,
  listarPorEnvio,
  listarAnterioresA,
  buscarEnvioConAsignacion,
  bloquearEnvioConAsignacion,
  marcarEntregado,
  liberarAsignacion,
  clavesConfirmadas,
};
