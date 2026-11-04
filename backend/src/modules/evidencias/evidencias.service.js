// Reglas del Dominio 4 (evidencias de entrega). Diseño en docs/consistencia.md §2.
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
//
// Regla principal: NINGÚN envío queda ENTREGADO sin evidencia guardada. Por eso:
//   1. Se comprueba en PostgreSQL que el envío esté EN_TRANSITO y asignado a ese repartidor.
//   2. Se guarda la evidencia en MongoDB con _id = clave_evidencia (reintento = mismo _id).
//   3. Se confirma ENTREGADO en UNA transacción de PostgreSQL: estado + evidencia_id +
//      liberar la capacidad del repartidor + evento en la outbox.
// Si el paso 3 falla, la evidencia queda "huérfana" y el reintento con la misma clave la
// reutiliza. Las que nadie reintenta se listan en GET /api/evidencias/huerfanas (decisión P4).
const { conTransaccion } = require('../../db/postgres');
const { registrarEvento } = require('../../shared/outbox');
const { ESTADOS, validarTransicion } = require('../../shared/estados');
const { errores } = require('../../shared/errores');
const { validar } = require('../../shared/validacion');
const { normalizarCodigo, esCodigoEnvio, esCodigoRepartidor } = require('../../shared/identificadores');
const repositorio = require('./evidencias.repository');

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIPOS_RECEPTOR = ['DESTINATARIO', 'FAMILIAR', 'VECINO', 'PORTERIA', 'OTRO'];
const PATRON_REFERENCIA = /^[A-Za-z0-9._:/-]{5,300}$/;

// Plazo para considerar huérfana una evidencia no confirmada (decisión P4).
const MINUTOS_HUERFANA = 10;

const ESQUEMA = {
  clave_evidencia: { tipo: 'texto', requerido: true, patron: PATRON_UUID, mensajePatron: 'clave_evidencia debe ser un UUID.' },
  codigo_envio: { tipo: 'texto', requerido: true, max: 12 },
  repartidor: { tipo: 'texto', requerido: true, max: 7 },
  receptor_tipo: { tipo: 'opcion', requerido: true, opciones: TIPOS_RECEPTOR },
  receptor_nombre: { tipo: 'texto', requerido: true, min: 2, max: 80 },
  receptor_documento: { tipo: 'texto', max: 20, patron: /^[0-9A-Za-z-]{4,20}$/, mensajePatron: 'receptor_documento solo admite letras, números y guiones (4 a 20).' },
  receptor_relacion: { tipo: 'texto', max: 60 },
  observacion: { tipo: 'texto', max: 300, porDefecto: '' },
  foto_referencia: { tipo: 'texto', requerido: true, min: 5, max: 300 },
  ubicacion_x: { tipo: 'numero', min: 0, max: 100 },
  ubicacion_y: { tipo: 'numero', min: 0, max: 100 },
};

/** La foto es simulada: una URL ficticia (https://…) o una referencia interna (SIM-…). */
function clasificarFoto(valor) {
  if (/^https?:\/\//i.test(valor)) {
    try {
      const url = new URL(valor);
      return { tipo: 'URL', valor: url.toString() };
    } catch {
      throw errores.validacion([{ campo: 'foto_referencia', mensaje: 'La URL de la foto no es válida.' }]);
    }
  }
  if (!PATRON_REFERENCIA.test(valor)) {
    throw errores.validacion([{
      campo: 'foto_referencia',
      mensaje: 'La foto debe ser una URL simulada (https://…) o una referencia sin espacios, como SIM-FOTO-0001.',
    }]);
  }
  return { tipo: 'REFERENCIA', valor };
}

function validarEntrada(cuerpo) {
  const d = validar(cuerpo, ESQUEMA);
  const detalles = [];
  const codigoEnvio = normalizarCodigo(d.codigo_envio);
  const repartidor = normalizarCodigo(d.repartidor);
  if (!esCodigoEnvio(codigoEnvio)) detalles.push({ campo: 'codigo_envio', mensaje: 'El código debe tener el formato ENV-XXXXXXXX.' });
  if (!esCodigoRepartidor(repartidor)) detalles.push({ campo: 'repartidor', mensaje: 'El repartidor debe tener el formato REP-NNN.' });
  // Datos heterogéneos: si no recibe el destinatario, hace falta saber quién es.
  if (d.receptor_tipo !== 'DESTINATARIO' && !d.receptor_relacion) {
    detalles.push({ campo: 'receptor_relacion', mensaje: 'Indica la relación con el destinatario (por ejemplo: hermana, conserje).' });
  }
  const tieneX = d.ubicacion_x !== undefined;
  if (tieneX !== (d.ubicacion_y !== undefined)) {
    detalles.push({ campo: 'ubicacion', mensaje: 'La ubicación simulada necesita ubicacion_x y ubicacion_y.' });
  }
  if (detalles.length) throw errores.validacion(detalles);
  return { ...d, clave: d.clave_evidencia.toLowerCase(), codigoEnvio, repartidor };
}

function construirDocumento(d) {
  const receptor = { tipo: d.receptor_tipo, nombre: d.receptor_nombre };
  if (d.receptor_documento) receptor.documento = d.receptor_documento;
  if (d.receptor_relacion) receptor.relacion = d.receptor_relacion;
  const documento = {
    _id: d.clave,
    codigo_envio: d.codigoEnvio,
    repartidor: d.repartidor,
    receptor,
    observacion: d.observacion,
    foto: clasificarFoto(d.foto_referencia),
    registrada_en: new Date(),
  };
  if (d.ubicacion_x !== undefined) {
    documento.ubicacion = { x: d.ubicacion_x, y: d.ubicacion_y, sistema: 'PLANO_FICTICIO_0_100' };
  }
  return documento;
}

/** Contrato público de una evidencia. */
function aPublica(doc, confirmada) {
  if (!doc) return null;
  const { _id, ...resto } = doc;
  return { clave_evidencia: _id, ...resto, confirmada };
}

/** Comprueba en PostgreSQL que la entrega se puede confirmar con esa evidencia. */
function comprobarEnvio(envio, d) {
  if (!envio) throw errores.noEncontrado(`No existe un envío con el código ${d.codigoEnvio}.`);
  if (envio.estado === ESTADOS.ENTREGADO) {
    if (envio.evidencia_id === d.clave) return 'YA_CONFIRMADA';
    throw errores.conflicto('YA_ENTREGADO', `El envío ${d.codigoEnvio} ya fue entregado con otra evidencia.`);
  }
  validarTransicion(envio.estado, ESTADOS.ENTREGADO); // 409 si no está EN_TRANSITO
  if (envio.repartidor_codigo !== d.repartidor) {
    throw errores.conflicto('NO_ASIGNADO', `El envío ${d.codigoEnvio} no está asignado a ${d.repartidor}.`);
  }
  return 'PENDIENTE';
}

/**
 * Registra la evidencia y confirma la entrega. Devuelve { evidencia, envio, creada }.
 * creada = false cuando es un reintento de una entrega ya confirmada con la misma clave.
 */
async function registrar(cuerpo) {
  const d = validarEntrada(cuerpo);
  const documento = construirDocumento(d);

  // Paso 1: precondiciones (lectura sin bloqueo; se vuelven a comprobar con bloqueo en el paso 3).
  const previo = comprobarEnvio(await repositorio.buscarEnvioConAsignacion(d.codigoEnvio), d);
  if (previo === 'YA_CONFIRMADA') {
    const guardada = await repositorio.buscarPorClave(d.clave);
    return { evidencia: aPublica(guardada, true), envio: { codigo: d.codigoEnvio, estado: ESTADOS.ENTREGADO }, creada: false };
  }

  // Paso 2: MongoDB primero. Si cae aquí, no cambió nada (503 por el errorHandler).
  let guardada = documento;
  try {
    await repositorio.insertar(documento);
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Reintento con la misma clave: se reutiliza el documento si es de la misma entrega.
    guardada = await repositorio.buscarPorClave(d.clave);
    if (!guardada || guardada.codigo_envio !== d.codigoEnvio || guardada.repartidor !== d.repartidor) {
      throw errores.conflicto('CLAVE_EN_USO', 'Esa clave de evidencia ya se usó para otra entrega. Recarga el formulario.');
    }
  }

  // Paso 3: confirmación oficial en PostgreSQL, en una sola transacción.
  const cambiado = await conTransaccion(async (cliente) => {
    const envio = await repositorio.bloquearEnvioConAsignacion(cliente, d.codigoEnvio);
    if (comprobarEnvio(envio, d) === 'YA_CONFIRMADA') return false;

    await repositorio.marcarEntregado(cliente, envio.id, d.clave);
    await repositorio.liberarAsignacion(cliente, envio.asignacion_id);
    const datosEvento = {
      estado_anterior: envio.estado,
      evidencia_id: d.clave,
      receptor_tipo: guardada.receptor.tipo,
      capacidad_liberada: true,
    };
    if (guardada.ubicacion) datosEvento.ubicacion = guardada.ubicacion;
    await registrarEvento(cliente, {
      codigoEnvio: d.codigoEnvio, tipo: ESTADOS.ENTREGADO, actor: d.repartidor, datos: datosEvento,
    });
    return true;
  });

  return {
    evidencia: aPublica(guardada, true),
    envio: { codigo: d.codigoEnvio, estado: ESTADOS.ENTREGADO },
    creada: cambiado,
  };
}

async function consultar(clave) {
  if (!PATRON_UUID.test(String(clave))) {
    throw errores.validacion([{ campo: 'clave_evidencia', mensaje: 'clave_evidencia debe ser un UUID.' }]);
  }
  const doc = await repositorio.buscarPorClave(String(clave).toLowerCase());
  if (!doc) throw errores.noEncontrado('No existe una evidencia con esa clave.');
  const confirmadas = await repositorio.clavesConfirmadas([doc._id]);
  return aPublica(doc, confirmadas.has(doc._id));
}

async function listarPorEnvio(codigoCrudo) {
  const codigo = normalizarCodigo(codigoCrudo);
  if (!esCodigoEnvio(codigo)) {
    throw errores.validacion([{ campo: 'codigo_envio', mensaje: 'El código debe tener el formato ENV-XXXXXXXX.' }]);
  }
  const docs = await repositorio.listarPorEnvio(codigo);
  const confirmadas = await repositorio.clavesConfirmadas(docs.map((x) => x._id));
  return docs.map((x) => aPublica(x, confirmadas.has(x._id)));
}

/** Reconciliación (P4): evidencias con más de 10 min que ningún envío ENTREGADO referencia. */
async function listarHuerfanas() {
  const limite = new Date(Date.now() - MINUTOS_HUERFANA * 60 * 1000);
  const candidatas = await repositorio.listarAnterioresA(limite);
  const confirmadas = await repositorio.clavesConfirmadas(candidatas.map((x) => x._id));
  return {
    plazo_minutos: MINUTOS_HUERFANA,
    revisado_en: new Date().toISOString(),
    huerfanas: candidatas.filter((x) => !confirmadas.has(x._id)).map((x) => aPublica(x, false)),
  };
}

module.exports = { registrar, consultar, listarPorEnvio, listarHuerfanas, aPublica, MINUTOS_HUERFANA, TIPOS_RECEPTOR };
