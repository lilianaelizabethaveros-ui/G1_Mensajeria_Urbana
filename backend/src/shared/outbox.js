// Registro de eventos en la outbox (decisiones D9 y D16).
// Se llama SIEMPRE dentro de la misma transacción que cambia el estado del envío,
// para que ambos se guarden juntos o ninguno. El sincronizador hacia MongoDB
// (módulo de seguimiento, Juan Fernando) lee los pendientes de esta tabla.

/**
 * @param {import('pg').PoolClient} cliente  Cliente de la transacción en curso
 * @param {{codigoEnvio: string, tipo: string, actor: string, datos?: object}} evento
 * @returns {Promise<{id: string, secuencia: string, ocurrido_en: Date}>}
 */
async function registrarEvento(cliente, { codigoEnvio, tipo, actor, datos = {} }) {
  if (!codigoEnvio || !tipo || !actor) {
    throw new Error('registrarEvento requiere codigoEnvio, tipo y actor');
  }
  const { rows } = await cliente.query(
    `INSERT INTO outbox (codigo_envio, tipo, actor, datos)
     VALUES ($1, $2, $3, $4)
     RETURNING id, secuencia, ocurrido_en`,
    [codigoEnvio, tipo, actor, JSON.stringify(datos)],
  );
  return rows[0];
}

/** Resumen para /health: eventos pendientes y antigüedad del más viejo. */
async function resumen(pool) {
  const { rows } = await pool.query(
    `SELECT count(*) FILTER (WHERE procesado_en IS NULL)::int AS pendientes,
            count(*)::int AS total,
            floor(extract(epoch FROM now() - min(ocurrido_en) FILTER (WHERE procesado_en IS NULL)))::int
              AS antiguedad_segundos
       FROM outbox`,
  );
  return rows[0];
}

module.exports = { registrarEvento, resumen };
