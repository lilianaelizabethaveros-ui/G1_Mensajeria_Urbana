// HTTP del Dominio 4 (evidencias de entrega): lee la petición y elige el código HTTP.
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
const servicio = require('./evidencias.service');

// POST /api/evidencias → 201 si se confirmó la entrega ahora; 200 si era un reintento ya confirmado.
async function registrar(req, res) {
  const { evidencia, envio, creada } = await servicio.registrar(req.body);
  res.status(creada ? 201 : 200).json({ ok: true, datos: { evidencia, envio, creada } });
}

// GET /api/evidencias?codigo_envio=ENV-…
async function listar(req, res) {
  res.json({ ok: true, datos: await servicio.listarPorEnvio(req.query.codigo_envio) });
}

// GET /api/evidencias/huerfanas
async function huerfanas(req, res) {
  res.json({ ok: true, datos: await servicio.listarHuerfanas() });
}

// GET /api/evidencias/:clave
async function consultar(req, res) {
  res.json({ ok: true, datos: await servicio.consultar(req.params.clave) });
}

module.exports = { registrar, listar, huerfanas, consultar };
