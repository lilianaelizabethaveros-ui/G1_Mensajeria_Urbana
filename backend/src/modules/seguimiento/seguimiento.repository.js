// Consultas del Dominio 3 (seguimiento y eventos).
// Responsable: Liliana Averos 
//
// - PostgreSQL: estado vigente del envío, asignación activa y outbox (fuente oficial).
// - MongoDB, colección "eventos": copia ordenada e inmutable de la outbox para la línea de tiempo.
const { pool } = require('../../db/postgres');
const { db } = require('../../db/mongo');

const eventos = db.collection('eventos');

// Estados en los que el envío está en manos del repartidor.
const ESTADOS_EN_RUTA = ['ASIGNADO', 'RETIRADO', 'EN_TRANSITO', 'INCIDENCIA'];

/** Índices de MongoDB. createIndex es idempotente: si ya existe, no hace nada. */
async function asegurarIndices() {
  await eventos.createIndex({ codigo_envio: 1, secuencia: 1 }, { name: 'eventos_envio_secuencia', unique: true });
  await eventos.createIndex({ actor: 1, ocurrido_en: -1 }, { name: 'eventos_actor_fecha' });
}

// ---------- PostgreSQL ----------

const COLUMNAS_ENVIO = `
  e.id, e.codigo, e.estado, e.descripcion, e.peso_kg, e.observaciones,
  e.remitente_nombre, e.origen_direccion, oz.codigo AS origen_zona_codigo, oz.nombre AS origen_zona_nombre,
  e.destinatario_nombre, e.destino_direccion, dz.codigo AS destino_zona_codigo, dz.nombre AS destino_zona_nombre,
  t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
  e.creado_en, e.actualizado_en, e.aceptado_en, e.cancelado_en, e.motivo_cancelacion,
  e.evidencia_id, e.entregado_en`;

const DESDE_ENVIO = `
  FROM envios e
  JOIN zonas oz ON oz.id = e.origen_zona_id
  JOIN zonas dz ON dz.id = e.destino_zona_id
  JOIN tipos_servicio t ON t.id = e.tipo_servicio_id`;

async function buscarEnvio(codigo, cliente = pool) {
  const { rows } = await cliente.query(`SELECT ${COLUMNAS_ENVIO} ${DESDE_ENVIO} WHERE e.codigo = $1`, [codigo]);
  return rows[0] || null;
}

/** Bloquea la fila del envío hasta el final de la transacción (regla de oro). */
async function bloquearEnvio(cliente, codigo) {
  const { rows } = await cliente.query(
    'SELECT id, codigo, estado, evidencia_id FROM envios WHERE codigo = $1 FOR UPDATE', [codigo]);
  return rows[0] || null;
}

/** Asignación activa del envío (tabla de Camila), con el código del repartidor. */
async function buscarAsignacionActiva(codigo, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT a.id, a.asignada_en, r.codigo AS repartidor_codigo, r.nombre AS repartidor_nombre
       FROM asignaciones a
       JOIN repartidores r ON r.id = a.repartidor_id
      WHERE a.codigo_envio = $1 AND a.liberada_en IS NULL`,
    [codigo],
  );
  return rows[0] || null;
}

/** Última asignación (activa o liberada): sirve para mostrar quién entregó. */
async function buscarUltimaAsignacion(codigo, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT a.id, a.asignada_en, a.liberada_en, r.codigo AS repartidor_codigo, r.nombre AS repartidor_nombre
       FROM asignaciones a
       JOIN repartidores r ON r.id = a.repartidor_id
      WHERE a.codigo_envio = $1
      ORDER BY a.asignada_en DESC, a.id DESC
      LIMIT 1`,
    [codigo],
  );
  return rows[0] || null;
}

async function buscarRepartidor(codigo, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT r.id, r.codigo, r.nombre, r.activo, r.capacidad_maxima, z.codigo AS zona_codigo, z.nombre AS zona_nombre
       FROM repartidores r JOIN zonas z ON z.id = r.zona_id
      WHERE r.codigo = $1`,
    [codigo],
  );
  return rows[0] || null;
}

/** Envíos que el repartidor tiene en curso (asignación activa). */
async function listarTareas(codigoRepartidor) {
  const { rows } = await pool.query(
    `SELECT e.codigo, e.estado, e.descripcion, e.peso_kg, e.observaciones,
            e.origen_direccion, oz.nombre AS origen_zona_nombre,
            e.destinatario_nombre, e.destino_direccion, dz.nombre AS destino_zona_nombre,
            t.nombre AS tipo_nombre, a.asignada_en, e.actualizado_en
       FROM asignaciones a
       JOIN repartidores r ON r.id = a.repartidor_id
       JOIN envios e ON e.codigo = a.codigo_envio
       JOIN zonas oz ON oz.id = e.origen_zona_id
       JOIN zonas dz ON dz.id = e.destino_zona_id
       JOIN tipos_servicio t ON t.id = e.tipo_servicio_id
      WHERE r.codigo = $1 AND a.liberada_en IS NULL AND e.estado = ANY($2)
      ORDER BY a.asignada_en, e.codigo`,
    [codigoRepartidor, ESTADOS_EN_RUTA],
  );
  return rows;
}

/** Cambio de estado del repartidor (RETIRADO, EN_TRANSITO, INCIDENCIA). */
async function actualizarEstado(cliente, id, estado) {
  await cliente.query('UPDATE envios SET estado = $1, actualizado_en = now() WHERE id = $2', [estado, id]);
}

/** INCIDENCIA → CANCELADO: la tabla exige cancelado_en (envios_cancelacion_coherente). */
async function marcarCancelado(cliente, id, motivo) {
  await cliente.query(
    `UPDATE envios SET estado = 'CANCELADO', cancelado_en = now(), motivo_cancelacion = $2, actualizado_en = now()
      WHERE id = $1`,
    [id, motivo],
  );
}

/** Devuelve la capacidad del repartidor: la asignación deja de estar activa. */
async function liberarAsignacion(cliente, asignacionId) {
  await cliente.query('UPDATE asignaciones SET liberada_en = now() WHERE id = $1 AND liberada_en IS NULL', [asignacionId]);
}

/** Conteo oficial de eventos del envío en la outbox y cuántos faltan copiar a MongoDB. */
async function contarOutbox(codigo) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE procesado_en IS NULL)::int AS pendientes
       FROM outbox WHERE codigo_envio = $1`,
    [codigo],
  );
  return rows[0];
}

// ---------- MongoDB ----------

/** Línea de tiempo del envío, en el orden en que ocurrieron los cambios. */
async function listarEventos(codigo) {
  return eventos.find({ codigo_envio: codigo }).sort({ secuencia: 1 }).toArray();
}

module.exports = {
  eventos,
  ESTADOS_EN_RUTA,
  asegurarIndices,
  buscarEnvio,
  bloquearEnvio,
  buscarAsignacionActiva,
  buscarUltimaAsignacion,
  buscarRepartidor,
  listarTareas,
  actualizarEstado,
  marcarCancelado,
  liberarAsignacion,
  contarOutbox,
  listarEventos,
};
