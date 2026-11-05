// HTTP del Dominio 6 (estado temporal del repartidor).
// Responsable: Liliana Averos 
const servicio = require('./estado-temporal.service');

async function listar(req, res) {
  res.json({ ok: true, datos: await servicio.listar() });
}

async function consultar(req, res) {
  res.json({ ok: true, datos: await servicio.consultar(req.params.codigo) });
}

async function actualizarUbicacion(req, res) {
  res.json({ ok: true, datos: await servicio.actualizarUbicacion(req.params.codigo, req.body) });
}

async function actualizarConexion(req, res) {
  res.json({ ok: true, datos: await servicio.actualizarConexion(req.params.codigo, req.body) });
}

async function marcarNoVigente(req, res) {
  res.json({ ok: true, datos: await servicio.marcarNoVigente(req.params.codigo) });
}

module.exports = { listar, consultar, actualizarUbicacion, actualizarConexion, marcarNoVigente };
