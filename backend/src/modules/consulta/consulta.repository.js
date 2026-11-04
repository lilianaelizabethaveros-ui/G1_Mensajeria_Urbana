'use strict';

// Dominio 5: Consulta operativa.
// PostgreSQL es la fuente oficial de los datos.
// Este repositorio permite buscar envíos mediante filtros combinados.

const { pool } = require('../../db/postgres');

/**
 * Buscar envíos por código, zona, estado, destinatario y fechas.
 *
 * Los filtros son opcionales y pueden combinarse.
 * La zona corresponde a la zona de destino del envío.
 *
 * @param {object} filtros
 * @returns {Promise<{resultados: Array, total: number}>}
 */
async function buscarEnvios(filtros = {}) {
  const {
    codigo,
    zona,
    estado,
    destinatario,
    fecha_desde,
    fecha_hasta,
    pagina = 1,
    limite = 20
  } = filtros;

  const condiciones = [];
  const parametros = [];

  // Filtro por código del envío.
  if (codigo) {
    parametros.push(`%${codigo}%`);
    condiciones.push(
      `e.codigo ILIKE $${parametros.length}`
    );
  }

  // Filtro por zona de destino.
  if (zona) {
    parametros.push(zona);
    condiciones.push(
      `zd.codigo = $${parametros.length}`
    );
  }

  // Filtro por estado del envío.
  if (estado) {
    parametros.push(estado);
    condiciones.push(
      `e.estado = $${parametros.length}`
    );
  }

  // Filtro por nombre del destinatario.
  if (destinatario) {
    parametros.push(`%${destinatario}%`);
    condiciones.push(
      `e.destinatario_nombre ILIKE $${parametros.length}`
    );
  }

  // Fecha inicial incluida.
  if (fecha_desde) {
    parametros.push(fecha_desde);
    condiciones.push(
      `e.creado_en >= $${parametros.length}::date`
    );
  }

  // Fecha final incluida.
  if (fecha_hasta) {
    parametros.push(fecha_hasta);
    condiciones.push(
      `e.creado_en < ($${parametros.length}::date + INTERVAL '1 day')`
    );
  }

  const donde = condiciones.length
    ? `WHERE ${condiciones.join(' AND ')}`
    : '';

  const tablas = `
    FROM envios e
    INNER JOIN zonas zo
      ON zo.id = e.origen_zona_id
    INNER JOIN zonas zd
      ON zd.id = e.destino_zona_id
    LEFT JOIN asignaciones a
      ON a.codigo_envio = e.codigo
      AND a.liberada_en IS NULL
    LEFT JOIN repartidores r
      ON r.id = a.repartidor_id
  `;

  // Obtener el total de coincidencias, sin paginación.
  const consultaTotal = `
    SELECT COUNT(*)::integer AS total
    ${tablas}
    ${donde}
  `;

  const resultadoTotal = await pool.query(
    consultaTotal,
    parametros
  );

  const total = resultadoTotal.rows[0].total;

  // Paginación de resultados.
  const desplazamiento = (pagina - 1) * limite;

  const parametrosListado = [
    ...parametros,
    limite,
    desplazamiento
  ];

  const posicionLimite = parametros.length + 1;
  const posicionDesplazamiento = parametros.length + 2;

  const consultaListado = `
    SELECT
      e.codigo,
      e.estado,
      e.remitente_nombre,
      e.destinatario_nombre,
      e.destinatario_telefono,
      e.destino_direccion,
      zo.codigo AS origen_zona,
      zd.codigo AS destino_zona,
      e.creado_en,
      e.actualizado_en,
      r.codigo AS repartidor_codigo,
      r.nombre AS repartidor_nombre
    ${tablas}
    ${donde}
    ORDER BY e.creado_en DESC, e.codigo DESC
    LIMIT $${posicionLimite}
    OFFSET $${posicionDesplazamiento}
  `;

  const resultado = await pool.query(
    consultaListado,
    parametrosListado
  );

  return {
    resultados: resultado.rows,
    total
  };
}

module.exports = {
  buscarEnvios
};
