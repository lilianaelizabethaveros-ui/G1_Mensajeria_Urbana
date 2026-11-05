// HTTP del Dominio 3 (seguimiento y eventos).
// Responsable: Liliana Averos
const servicio = require('./seguimiento.service');

// GET /api/seguimiento/sincronizador
async function sincronizador(req, res) {
  res.json({ ok: true, datos: servicio.estadoSincronizador() });
}

// GET /api/seguimiento/repartidores/:codigo/tareas
async function tareas(req, res) {
  res.json({ ok: true, datos: await servicio.listarTareas(req.params.codigo) });
}

// GET /api/seguimiento/:codigo
async function consultar(req, res) {
  res.json({ ok: true, datos: await servicio.consultar(req.params.codigo) });
}

// POST /api/seguimiento/:codigo/eventos → 201 si registró un cambio; 200 si ya estaba en ese estado.
async function registrarCambio(req, res) {
  const datos = await servicio.registrarCambio(req.params.codigo, req.body);
  res.status(datos.cambiado ? 201 : 200).json({ ok: true, datos });
}

module.exports = { sincronizador, tareas, consultar, registrarCambio };
