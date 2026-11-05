// Reglas del Dominio 6 (estado temporal del repartidor).
// Responsable: Liliana Averos 
//
// - Si Redis está caído, SOLO este módulo responde 503: el resto de la API sigue igual.
// - La ubicación usa un plano FICTICIO de 0 a 100 (x, y): nunca coordenadas reales.
// - Un dato expirado o borrado se informa como "sin dato vigente"; no es un error.
// - La ubicación nunca equivale a prueba de entrega (esa es la evidencia del Dominio 4).
const { errores } = require('../../shared/errores');
const { validar } = require('../../shared/validacion');
const { normalizarCodigo, esCodigoRepartidor, esCodigoEnvio } = require('../../shared/identificadores');
const repositorio = require('./estado-temporal.repository');

const ESTADOS_CONEXION = ['EN_LINEA', 'OCUPADO', 'EN_PAUSA'];

function exigirRedis() {
  if (!repositorio.disponible()) {
    throw errores.noDisponible('El estado temporal (Redis) no está disponible. Los envíos, el historial y las evidencias siguen funcionando; reintenta en unos segundos.');
  }
}

function validarCodigoRepartidor(valor) {
  const codigo = normalizarCodigo(valor);
  if (!esCodigoRepartidor(codigo)) {
    throw errores.validacion([{ campo: 'repartidor', mensaje: 'El repartidor debe tener el formato REP-NNN.' }]);
  }
  return codigo;
}

async function exigirRepartidor(valor) {
  const codigo = validarCodigoRepartidor(valor);
  const repartidor = await repositorio.buscarRepartidor(codigo);
  if (!repartidor) throw errores.noEncontrado(`No existe el repartidor ${codigo}.`);
  return repartidor;
}

function aDato(tipo, leido) {
  if (!leido) {
    return { vigente: false, mensaje: 'Sin dato vigente', ttl_maximo_segundos: repositorio.TTL_SEGUNDOS[tipo] };
  }
  return {
    vigente: true,
    ...leido.valor,
    ttl_segundos: leido.ttl,
    ttl_maximo_segundos: repositorio.TTL_SEGUNDOS[tipo],
    expira_en: new Date(Date.now() + leido.ttl * 1000).toISOString(),
  };
}

function aEstadoPublico(repartidor, leido) {
  return {
    repartidor: {
      codigo: repartidor.codigo, nombre: repartidor.nombre, activo: repartidor.activo,
      zona: { codigo: repartidor.zona_codigo, nombre: repartidor.zona_nombre },
    },
    ubicacion: aDato('ubicacion', leido?.ubicacion),
    conexion: aDato('conexion', leido?.conexion),
    fuente: 'Redis (dato temporal con expiración; no es fuente oficial)',
    consultado_en: new Date().toISOString(),
  };
}

async function consultar(codigoRepartidor) {
  const repartidor = await exigirRepartidor(codigoRepartidor);
  exigirRedis();
  return aEstadoPublico(repartidor, await repositorio.leer(repartidor.codigo));
}

async function listar() {
  const repartidores = await repositorio.listarRepartidores();
  exigirRedis();
  const leidos = await repositorio.leerVarios(repartidores.map((r) => r.codigo));
  return repartidores.map((r) => aEstadoPublico(r, leidos.get(r.codigo)));
}

async function actualizarUbicacion(codigoRepartidor, cuerpo) {
  const repartidor = await exigirRepartidor(codigoRepartidor);
  const d = validar(cuerpo, {
    x: { tipo: 'numero', requerido: true, min: 0, max: 100 },
    y: { tipo: 'numero', requerido: true, min: 0, max: 100 },
    codigo_envio: { tipo: 'texto', max: 12 },
  });
  const valor = {
    x: Math.round(d.x * 10) / 10,
    y: Math.round(d.y * 10) / 10,
    sistema: 'PLANO_FICTICIO_0_100',
    registrada_en: new Date().toISOString(),
  };
  if (d.codigo_envio) {
    const codigo = normalizarCodigo(d.codigo_envio);
    if (!esCodigoEnvio(codigo)) {
      throw errores.validacion([{ campo: 'codigo_envio', mensaje: 'El código debe tener el formato ENV-XXXXXXXX.' }]);
    }
    valor.codigo_envio = codigo;
  }
  exigirRedis();
  await repositorio.guardar(repartidor.codigo, 'ubicacion', valor);
  return aEstadoPublico(repartidor, await repositorio.leer(repartidor.codigo));
}

async function actualizarConexion(codigoRepartidor, cuerpo) {
  const repartidor = await exigirRepartidor(codigoRepartidor);
  const d = validar(cuerpo, { estado: { tipo: 'opcion', requerido: true, opciones: ESTADOS_CONEXION } });
  exigirRedis();
  await repositorio.guardar(repartidor.codigo, 'conexion', { estado: d.estado, actualizado_en: new Date().toISOString() });
  return aEstadoPublico(repartidor, await repositorio.leer(repartidor.codigo));
}

async function marcarNoVigente(codigoRepartidor) {
  const repartidor = await exigirRepartidor(codigoRepartidor);
  exigirRedis();
  const borradas = await repositorio.borrar(repartidor.codigo);
  return { ...aEstadoPublico(repartidor, null), claves_borradas: borradas };
}

/**
 * Uso interno (seguimiento): lee el estado temporal sin lanzar error si Redis está caído.
 * Devuelve null cuando Redis no está disponible.
 */
async function leerSinFallar(codigoRepartidor) {
  if (!repositorio.disponible()) return null;
  try {
    const leido = await repositorio.leer(codigoRepartidor);
    return { ubicacion: aDato('ubicacion', leido.ubicacion), conexion: aDato('conexion', leido.conexion) };
  } catch {
    return null;
  }
}

/** Uso interno (seguimiento): guarda la ubicación de un cambio de estado; si Redis falla, se ignora. */
async function guardarSinFallar(codigoRepartidor, ubicacion, codigoEnvio) {
  if (!repositorio.disponible() || !ubicacion) return false;
  try {
    await repositorio.guardar(codigoRepartidor, 'ubicacion', {
      x: ubicacion.x, y: ubicacion.y, sistema: 'PLANO_FICTICIO_0_100',
      codigo_envio: codigoEnvio, registrada_en: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ESTADOS_CONEXION,
  consultar,
  listar,
  actualizarUbicacion,
  actualizarConexion,
  marcarNoVigente,
  leerSinFallar,
  guardarSinFallar,
};
