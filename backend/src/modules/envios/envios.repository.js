// Consultas SQL del Dominio 1. Solo este archivo habla con la tabla envios.
// Cada función recibe opcionalmente el cliente de una transacción en curso.
const { pool } = require('../../db/postgres');

const SELECT_ENVIO = `
  SELECT e.id, e.codigo, e.estado,
         e.remitente_nombre, e.remitente_telefono, e.origen_direccion,
         zo.codigo AS origen_zona_codigo, zo.nombre AS origen_zona_nombre,
         e.destinatario_nombre, e.destinatario_telefono, e.destino_direccion,
         zd.codigo AS destino_zona_codigo, zd.nombre AS destino_zona_nombre,
         ts.codigo AS tipo_codigo, ts.nombre AS tipo_nombre, ts.tiempo_estimado_horas,
         e.descripcion, e.peso_kg::float AS peso_kg, e.observaciones,
         e.creado_en, e.actualizado_en, e.aceptado_en, e.cancelado_en, e.motivo_cancelacion
    FROM envios e
    JOIN zonas zo ON zo.id = e.origen_zona_id
    JOIN zonas zd ON zd.id = e.destino_zona_id
    JOIN tipos_servicio ts ON ts.id = e.tipo_servicio_id`;

async function insertar(cliente, d) {
  const { rows } = await cliente.query(
    `INSERT INTO envios (
        codigo, tipo_servicio_id,
        remitente_nombre, remitente_telefono, origen_direccion, origen_zona_id,
        destinatario_nombre, destinatario_telefono, destino_direccion, destino_zona_id,
        descripcion, peso_kg, observaciones, clave_idempotencia)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [d.codigo, d.tipoServicioId,
      d.remitente_nombre, d.remitente_telefono, d.origen_direccion, d.origenZonaId,
      d.destinatario_nombre, d.destinatario_telefono, d.destino_direccion, d.destinoZonaId,
      d.descripcion, d.peso_kg, d.observaciones, d.claveIdempotencia],
  );
  return rows[0].id;
}

async function buscarPorCodigo(codigo, cliente = pool) {
  const { rows } = await cliente.query(`${SELECT_ENVIO} WHERE e.codigo = $1`, [codigo]);
  return rows[0] || null;
}

async function buscarPorClaveIdempotencia(clave, cliente = pool) {
  const { rows } = await cliente.query(`${SELECT_ENVIO} WHERE e.clave_idempotencia = $1`, [clave]);
  return rows[0] || null;
}

/** Bloquea la fila hasta el fin de la transacción (evita dos cambios de estado simultáneos). */
async function bloquearPorCodigo(cliente, codigo) {
  const { rows } = await cliente.query(
    'SELECT id, codigo, estado FROM envios WHERE codigo = $1 FOR UPDATE', [codigo],
  );
  return rows[0] || null;
}

async function marcarAceptado(cliente, id) {
  await cliente.query(
    `UPDATE envios SET estado = 'ACEPTADO', aceptado_en = now(), actualizado_en = now()
      WHERE id = $1`, [id],
  );
}

async function marcarCancelado(cliente, id, motivo) {
  await cliente.query(
    `UPDATE envios SET estado = 'CANCELADO', cancelado_en = now(), motivo_cancelacion = $2,
            actualizado_en = now()
      WHERE id = $1`, [id, motivo],
  );
}

module.exports = {
  insertar,
  buscarPorCodigo,
  buscarPorClaveIdempotencia,
  bloquearPorCodigo,
  marcarAceptado,
  marcarCancelado,
};
