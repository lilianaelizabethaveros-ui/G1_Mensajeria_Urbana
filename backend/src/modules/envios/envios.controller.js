// Capa HTTP del Dominio 1: lee la petición, llama al servicio y elige el código HTTP.
const servicio = require('./envios.service');
const validacion = require('./envios.validation');

// POST /api/envios
async function registrar(req, res) {
  const datos = validacion.validarSolicitud(req.body);
  const clave = validacion.validarClaveIdempotencia(req.get('Idempotency-Key'));
  const { envio, creado } = await servicio.registrarSolicitud(datos, clave);
  if (creado) res.location(`/api/envios/${envio.codigo}`);
  res.status(creado ? 201 : 200).json({ ok: true, datos: envio, ...(creado ? {} : { repetido: true }) });
}

// GET /api/envios/:codigo
async function consultar(req, res) {
  const codigo = validacion.validarCodigo(req.params.codigo);
  res.json({ ok: true, datos: await servicio.consultar(codigo) });
}

// PATCH /api/envios/:codigo/aceptar
async function aceptar(req, res) {
  const codigo = validacion.validarCodigo(req.params.codigo);
  const { envio, cambiado } = await servicio.aceptar(codigo);
  res.json({ ok: true, datos: envio, cambiado });
}

// PATCH /api/envios/:codigo/cancelar   { motivo, actor? }
async function cancelar(req, res) {
  const codigo = validacion.validarCodigo(req.params.codigo);
  const datos = validacion.validarCancelacion(req.body);
  const { envio, cambiado } = await servicio.cancelar(codigo, datos);
  res.json({ ok: true, datos: envio, cambiado });
}

module.exports = { registrar, consultar, aceptar, cancelar };
