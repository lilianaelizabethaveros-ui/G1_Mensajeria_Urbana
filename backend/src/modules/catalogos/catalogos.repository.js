// Consultas de catálogos en PostgreSQL (zonas y tipos de servicio).
const { pool } = require('../../db/postgres');

async function listarZonasActivas(cliente = pool) {
  const { rows } = await cliente.query(
    'SELECT codigo, nombre FROM zonas WHERE activa ORDER BY id',
  );
  return rows;
}

async function listarTiposServicioActivos(cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT codigo, nombre, descripcion, tiempo_estimado_horas,
            peso_maximo_kg::float AS peso_maximo_kg
       FROM tipos_servicio WHERE activo ORDER BY id`,
  );
  return rows;
}

async function buscarZonaActiva(codigo, cliente = pool) {
  const { rows } = await cliente.query(
    'SELECT id, codigo, nombre FROM zonas WHERE codigo = $1 AND activa', [codigo],
  );
  return rows[0] || null;
}

async function buscarTipoServicioActivo(codigo, cliente = pool) {
  const { rows } = await cliente.query(
    `SELECT id, codigo, nombre, tiempo_estimado_horas, peso_maximo_kg::float AS peso_maximo_kg
       FROM tipos_servicio WHERE codigo = $1 AND activo`, [codigo],
  );
  return rows[0] || null;
}

module.exports = {
  listarZonasActivas,
  listarTiposServicioActivos,
  buscarZonaActiva,
  buscarTipoServicioActivo,
};
