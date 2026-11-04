'use strict';

// Dominio 5: Consulta operativa.
// Controlador de las búsquedas de envíos.

const servicio = require('./consulta.service');

/**
 * GET /api/consulta
 *
 * Filtros opcionales:
 * - codigo
 * - zona
 * - estado
 * - destinatario
 * - fecha_desde
 * - fecha_hasta
 * - pagina
 * - limite
 *
 * Devuelve los envíos que coincidan con los filtros.
 */
async function buscarEnvios(req, res, next) {
  try {
    const resultado = await servicio.buscarEnvios(req.query);

    res.status(200).json({
      ok: true,
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  buscarEnvios
};
