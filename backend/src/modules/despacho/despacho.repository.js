const { pool } = require('../../db/postgres');

// Consultar los repartidores registrados y su zona.

 // Consultar los repartidores, su zona y su carga actual.
async function listarRepartidores() {
  const { rows } = await pool.query(
    `SELECT
       r.id,
       r.codigo,
       r.nombre,
       z.codigo AS zona,
       r.capacidad_maxima,
       r.activo,
       COUNT(a.id)::integer AS carga_actual,
       (r.capacidad_maxima - COUNT(a.id))::integer AS cupos_disponibles
     FROM repartidores r
     JOIN zonas z ON z.id = r.zona_id
     LEFT JOIN asignaciones a
       ON a.repartidor_id = r.id
       AND a.liberada_en IS NULL
     GROUP BY
       r.id,
       r.codigo,
       r.nombre,
       z.codigo,
       r.capacidad_maxima,
       r.activo
     ORDER BY r.codigo`
  );

  return rows;
}



// Consultar envíos aceptados que están pendientes de asignación.
async function listarEnviosPendientes() {
  const { rows } = await pool.query(
    `SELECT
       e.codigo,
       e.estado,
       e.destinatario_nombre,
       z.codigo AS zona_destino,
       e.creado_en,
       e.aceptado_en
     FROM envios e
     JOIN zonas z ON z.id = e.destino_zona_id
     WHERE e.estado = 'ACEPTADO'
     ORDER BY e.aceptado_en ASC, e.codigo ASC`
  );

  return rows;
}


// Bloquear un envío durante una transacción de asignación.
async function bloquearEnvio(cliente, codigo) {
  const { rows } = await cliente.query(
    `SELECT
       id,
       codigo,
       estado,
       destino_zona_id
     FROM envios
     WHERE codigo = $1
     FOR UPDATE`,
    [codigo]
  );

  return rows[0] || null;
}

// Bloquear un repartidor y consultar su capacidad disponible.
async function bloquearRepartidor(cliente, codigo) {
  // Primero bloquear al repartidor.
  const { rows } = await cliente.query(
    `SELECT
       id,
       codigo,
       nombre,
       zona_id,
       capacidad_maxima,
       activo
     FROM repartidores
     WHERE codigo = $1
     FOR UPDATE`,
    [codigo]
  );

  const repartidor = rows[0];

  if (!repartidor) {
    return null;
  }

  // Contar las asignaciones después de obtener el bloqueo.
  const resultado = await cliente.query(
    `SELECT COUNT(*)::integer AS asignaciones_activas
     FROM asignaciones
     WHERE repartidor_id = $1
       AND liberada_en IS NULL`,
    [repartidor.id]
  );

  repartidor.asignaciones_activas =
    resultado.rows[0].asignaciones_activas;

  return repartidor;
}

// Registrar una nueva asignación dentro de una transacción.
async function crearAsignacion(cliente, codigoEnvio, repartidorId) {
  const { rows } = await cliente.query(
    `INSERT INTO asignaciones (codigo_envio, repartidor_id)
     VALUES ($1, $2)
     RETURNING
       id,
       codigo_envio,
       repartidor_id,
       asignada_en`,
    [codigoEnvio, repartidorId]
  );

  return rows[0];
}


// Actualizar el estado del envío después de asignar un repartidor.
async function marcarAsignado(cliente, codigoEnvio) {
  const { rows } = await cliente.query(
    `UPDATE envios
     SET estado = 'ASIGNADO',
         actualizado_en = now()
     WHERE codigo = $1
       AND estado = 'ACEPTADO'
     RETURNING codigo, estado, actualizado_en`,
    [codigoEnvio]
  );

  return rows[0] || null;
}


// Consultar la asignación activa de un envío.
async function buscarAsignacionActiva(cliente, codigoEnvio) {
  const { rows } = await cliente.query(
    `SELECT
       a.id,
       a.codigo_envio,
       a.repartidor_id,
       r.codigo AS codigo_repartidor,
       a.asignada_en
     FROM asignaciones a
     JOIN repartidores r ON r.id = a.repartidor_id
     WHERE a.codigo_envio = $1
       AND a.liberada_en IS NULL`,
    [codigoEnvio]
  );

  return rows[0] || null;
}


 // Registrar la liberación de una asignación activa.
async function liberarAsignacion(cliente, asignacionId) {
  const { rows } = await cliente.query(
    `UPDATE asignaciones
     SET liberada_en = now()
     WHERE id = $1
       AND liberada_en IS NULL
     RETURNING
       id,
       codigo_envio,
       repartidor_id,
       asignada_en,
       liberada_en`,
    [asignacionId]
  );

  return rows[0] || null;
}


 // Regresar el envío al estado ACEPTADO.
async function marcarAceptado(cliente, codigoEnvio) {
  const { rows } = await cliente.query(
    `UPDATE envios
     SET estado = 'ACEPTADO',
         actualizado_en = now()
     WHERE codigo = $1
       AND estado = 'ASIGNADO'
     RETURNING codigo, estado, actualizado_en`,
    [codigoEnvio]
  );

  return rows[0] || null;
}

 // Registrar el repartidor que reemplaza al anterior.
async function crearReasignacion(cliente, codigoEnvio, repartidorId) {
  const { rows } = await cliente.query(
    `INSERT INTO asignaciones (codigo_envio, repartidor_id)
     VALUES ($1, $2)
     RETURNING id, codigo_envio, repartidor_id, asignada_en`,
    [codigoEnvio, repartidorId]
  );

  return rows[0];
}

// Consultar todas las zonas para el panel administrativo.
async function listarZonas() {
  const { rows } = await pool.query(
    `SELECT
       id,
       codigo,
       nombre,
       activa
     FROM zonas
     ORDER BY codigo`
  );

  return rows;
}

// Registrar una nueva zona desde el panel administrativo.
async function crearZona(codigo, nombre) {
  const { rows } = await pool.query(
    `INSERT INTO zonas (codigo, nombre)
     VALUES ($1, $2)
     RETURNING id, codigo, nombre, activa`,
    [codigo, nombre]
  );

  return rows[0];
}

// Actualizar el nombre y estado de una zona.
async function actualizarZona(codigo, nombre, activa) {
  const { rows } = await pool.query(
    `UPDATE zonas
     SET nombre = $2,
         activa = $3
     WHERE codigo = $1
     RETURNING id, codigo, nombre, activa`,
    [codigo, nombre, activa]
  );

  return rows[0] || null;
}

// Actualizar los datos de un repartidor.
async function actualizarRepartidor(codigo, nombre, zonaCodigo, capacidadMaxima, activo) {
  const { rows } = await pool.query(
    `UPDATE repartidores
     SET nombre = $2,
         zona_id = (SELECT id FROM zonas WHERE codigo = $3 AND activa = true),
         capacidad_maxima = $4,
         activo = $5
     WHERE codigo = $1
     RETURNING id, codigo, nombre, zona_id, capacidad_maxima, activo`,
    [codigo, nombre, zonaCodigo, capacidadMaxima, activo]
  );

  return rows[0] || null;
}

// Crear un repartidor con datos ficticios.
async function crearRepartidor(codigo, nombre, zonaId, capacidadMaxima) {
  const { rows } = await pool.query(
    `INSERT INTO repartidores
       (codigo, nombre, zona_id, capacidad_maxima)
     VALUES ($1, $2, $3, $4)
     RETURNING id, codigo, nombre, zona_id, capacidad_maxima, activo`,
    [codigo, nombre, zonaId, capacidadMaxima]
  );

  return rows[0];
}

module.exports = {
  listarRepartidores,
  listarEnviosPendientes,
  bloquearEnvio,
  bloquearRepartidor,
  crearAsignacion,
  marcarAsignado,
   buscarAsignacionActiva,
   liberarAsignacion,
   marcarAceptado,
   crearReasignacion,
  listarZonas,
  crearZona,
  actualizarZona,
  actualizarRepartidor,
  crearRepartidor
};
