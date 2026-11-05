// Reglas del Dominio 3 (seguimiento y eventos).
// Responsable: Liliana Averos 
//
// - El estado VIGENTE siempre sale de PostgreSQL (envios.estado).
// - El HISTORIAL sale de MongoDB "eventos", copiado desde la outbox por el sincronizador.
//   Si MongoDB está caído o atrasado, se responde igual con el estado vigente y se avisa.
// - Los cambios del repartidor siguen la regla de oro: una transacción con bloqueo de fila,
//   validarTransicion, UPDATE del estado y registrarEvento (actor REP-NNN).
const { conTransaccion } = require('../../db/postgres');
const { registrarEvento } = require('../../shared/outbox');
const { ESTADOS, TRANSICIONES, validarTransicion } = require('../../shared/estados');
const { errores } = require('../../shared/errores');
const { validar } = require('../../shared/validacion');
const { normalizarCodigo, esCodigoEnvio, esCodigoRepartidor } = require('../../shared/identificadores');
const repositorio = require('./seguimiento.repository');
const sincronizador = require('./seguimiento.sincronizador');
const evidencias = require('../evidencias/evidencias.repository');
const { aPublica: evidenciaPublica } = require('../evidencias/evidencias.service');
const estadoTemporal = require('../estado-temporal/estado-temporal.service');

// Estados que el repartidor puede registrar con este endpoint. ENTREGADO va por /api/evidencias.
const ESTADOS_REPARTIDOR = [ESTADOS.RETIRADO, ESTADOS.EN_TRANSITO, ESTADOS.INCIDENCIA, ESTADOS.CANCELADO];
const EXIGEN_MOTIVO = [ESTADOS.INCIDENCIA, ESTADOS.CANCELADO];

function validarCodigoEnvio(valor) {
  const codigo = normalizarCodigo(valor);
  if (!esCodigoEnvio(codigo)) {
    throw errores.validacion([{ campo: 'codigo', mensaje: 'El código debe tener el formato ENV-XXXXXXXX.' }]);
  }
  return codigo;
}

function validarCodigoRepartidor(valor, campo = 'repartidor') {
  const codigo = normalizarCodigo(valor);
  if (!esCodigoRepartidor(codigo)) {
    throw errores.validacion([{ campo, mensaje: 'El repartidor debe tener el formato REP-NNN.' }]);
  }
  return codigo;
}

/** Acciones que el repartidor puede hacer desde un estado (ASIGNADO → ACEPTADO es del operador). */
function accionesRepartidor(estado) {
  return (TRANSICIONES[estado] || []).filter((e) => e !== ESTADOS.ACEPTADO);
}

function aEventoPublico(doc) {
  return {
    id: doc._id,
    secuencia: doc.secuencia,
    tipo: doc.tipo,
    actor: doc.actor,
    datos: doc.datos,
    ocurrido_en: doc.ocurrido_en,
    sincronizado_en: doc.sincronizado_en,
  };
}

function aEnvioResumen(f) {
  return {
    codigo: f.codigo,
    estado: f.estado,
    tipo_servicio: { codigo: f.tipo_codigo, nombre: f.tipo_nombre },
    remitente: { nombre: f.remitente_nombre },
    origen: { direccion: f.origen_direccion, zona: { codigo: f.origen_zona_codigo, nombre: f.origen_zona_nombre } },
    destinatario: { nombre: f.destinatario_nombre },
    destino: { direccion: f.destino_direccion, zona: { codigo: f.destino_zona_codigo, nombre: f.destino_zona_nombre } },
    paquete: { descripcion: f.descripcion, peso_kg: f.peso_kg },
    observaciones: f.observaciones,
    motivo_cancelacion: f.motivo_cancelacion,
    evidencia_id: f.evidencia_id,
    fechas: {
      creado_en: f.creado_en, actualizado_en: f.actualizado_en, aceptado_en: f.aceptado_en,
      cancelado_en: f.cancelado_en, entregado_en: f.entregado_en,
    },
  };
}

/**
 * GET /api/seguimiento/:codigo
 * Estado vigente (PostgreSQL) + línea de tiempo (MongoDB) + evidencia + estado temporal (Redis).
 */
async function consultar(codigoCrudo) {
  const codigo = validarCodigoEnvio(codigoCrudo);
  const fila = await repositorio.buscarEnvio(codigo);
  if (!fila) throw errores.noEncontrado(`No existe un envío con el código ${codigo}.`);

  const [asignacion, outbox] = await Promise.all([
    repositorio.buscarUltimaAsignacion(codigo),
    repositorio.contarOutbox(codigo),
  ]);

  // Historial desde MongoDB: si no responde, el estado vigente se muestra igual.
  const historial = {
    disponible: true,
    fuente: 'MongoDB (copia de la outbox)',
    eventos_oficiales: outbox.total,
    pendientes_sincronizar: outbox.pendientes,
    al_dia: outbox.pendientes === 0,
    coherente: null,
    eventos: [],
  };
  try {
    historial.eventos = (await repositorio.listarEventos(codigo)).map(aEventoPublico);
    const ultimo = historial.eventos.at(-1);
    // Con el historial al día, el último evento debe coincidir con el estado vigente.
    historial.coherente = historial.al_dia ? Boolean(ultimo && ultimo.tipo === fila.estado) : null;
  } catch (error) {
    historial.disponible = false;
    historial.al_dia = false;
    historial.mensaje = 'El historial (MongoDB) no está disponible en este momento. El estado vigente sí es oficial; los eventos se copiarán cuando MongoDB vuelva.';
    console.error(`[seguimiento] historial de ${codigo} no disponible:`, error.message);
  }
  if (historial.disponible && !historial.al_dia) {
    historial.mensaje = `Hay ${outbox.pendientes} evento(s) registrados en PostgreSQL que aún no se copian a MongoDB.`;
  }

  // Evidencia: solo es prueba de entrega si envios.evidencia_id la referencia.
  let evidencia = null;
  if (fila.evidencia_id) {
    try {
      evidencia = evidenciaPublica(await evidencias.buscarPorClave(fila.evidencia_id), true)
        || { clave_evidencia: fila.evidencia_id, confirmada: true, disponible: false };
    } catch {
      evidencia = { clave_evidencia: fila.evidencia_id, confirmada: true, disponible: false,
        mensaje: 'La entrega está confirmada en PostgreSQL; el detalle de la evidencia (MongoDB) no está disponible ahora.' };
    }
  }

  // Estado temporal del repartidor solo mientras el envío está en ruta.
  let temporal = null;
  if (asignacion && !asignacion.liberada_en && repositorio.ESTADOS_EN_RUTA.includes(fila.estado)) {
    temporal = await estadoTemporal.leerSinFallar(asignacion.repartidor_codigo);
    if (temporal === null) temporal = { disponible: false, mensaje: 'Estado temporal no disponible (Redis).' };
  }

  return {
    envio: aEnvioResumen(fila),
    estado_vigente: { estado: fila.estado, fuente: 'PostgreSQL', actualizado_en: fila.actualizado_en },
    repartidor: asignacion
      ? {
        codigo: asignacion.repartidor_codigo,
        nombre: asignacion.repartidor_nombre,
        asignada_en: asignacion.asignada_en,
        activa: !asignacion.liberada_en,
        liberada_en: asignacion.liberada_en,
      }
      : null,
    historial,
    evidencia,
    estado_temporal: temporal,
  };
}

/**
 * POST /api/seguimiento/:codigo/eventos  { repartidor, estado, motivo?, observacion?, ubicacion_x?, ubicacion_y? }
 * Retiro, tránsito, incidencia (y cancelación tras una incidencia) registrados por el repartidor.
 */
async function registrarCambio(codigoCrudo, cuerpo) {
  const codigo = validarCodigoEnvio(codigoCrudo);
  const d = validar(cuerpo, {
    repartidor: { tipo: 'texto', requerido: true, max: 7 },
    estado: { tipo: 'opcion', requerido: true, opciones: [...ESTADOS_REPARTIDOR, ESTADOS.ENTREGADO] },
    motivo: { tipo: 'texto', min: 3, max: 200 },
    observacion: { tipo: 'texto', max: 300 },
    ubicacion_x: { tipo: 'numero', min: 0, max: 100 },
    ubicacion_y: { tipo: 'numero', min: 0, max: 100 },
  });
  const repartidor = validarCodigoRepartidor(d.repartidor);
  if (d.estado === ESTADOS.ENTREGADO) {
    throw errores.conflicto('REQUIERE_EVIDENCIA',
      'La entrega se registra con su evidencia (POST /api/evidencias). La ubicación no es prueba de entrega.');
  }
  if (EXIGEN_MOTIVO.includes(d.estado) && !d.motivo) {
    throw errores.validacion([{ campo: 'motivo', mensaje: `El motivo es obligatorio para ${d.estado}.` }]);
  }
  if ((d.ubicacion_x === undefined) !== (d.ubicacion_y === undefined)) {
    throw errores.validacion([{ campo: 'ubicacion', mensaje: 'La ubicación simulada necesita ubicacion_x y ubicacion_y.' }]);
  }
  const ubicacion = d.ubicacion_x === undefined ? null
    : { x: d.ubicacion_x, y: d.ubicacion_y, sistema: 'PLANO_FICTICIO_0_100' };

  const resultado = await conTransaccion(async (cliente) => {
    const envio = await repositorio.bloquearEnvio(cliente, codigo);
    if (!envio) throw errores.noEncontrado(`No existe un envío con el código ${codigo}.`);

    // Idempotencia (D33): repetir el mismo cambio no crea un evento nuevo.
    if (envio.estado === d.estado) return { estado_anterior: envio.estado, cambiado: false };

    const asignacion = await repositorio.buscarAsignacionActiva(codigo, cliente);
    if (!asignacion || asignacion.repartidor_codigo !== repartidor) {
      throw errores.conflicto('NO_ASIGNADO', `El envío ${codigo} no está asignado a ${repartidor}.`);
    }
    validarTransicion(envio.estado, d.estado); // 409 TRANSICION_INVALIDA

    if (d.estado === ESTADOS.CANCELADO) {
      await repositorio.marcarCancelado(cliente, envio.id, d.motivo);
      await repositorio.liberarAsignacion(cliente, asignacion.id); // devuelve la capacidad
    } else {
      await repositorio.actualizarEstado(cliente, envio.id, d.estado);
    }

    const datos = { estado_anterior: envio.estado };
    if (d.motivo) datos.motivo = d.motivo;
    if (d.observacion) datos.observacion = d.observacion;
    if (ubicacion) datos.ubicacion = ubicacion;
    if (d.estado === ESTADOS.CANCELADO) datos.capacidad_liberada = true;
    const evento = await registrarEvento(cliente, { codigoEnvio: codigo, tipo: d.estado, actor: repartidor, datos });
    return { estado_anterior: envio.estado, cambiado: true, evento };
  });

  // Fuera de la transacción: la ubicación se copia a Redis como dato temporal (si Redis falla, no importa).
  let ubicacionTemporal = false;
  if (resultado.cambiado && ubicacion) {
    ubicacionTemporal = await estadoTemporal.guardarSinFallar(repartidor, ubicacion, codigo);
  }

  return {
    codigo_envio: codigo,
    estado: d.estado,
    estado_anterior: resultado.estado_anterior,
    actor: repartidor,
    cambiado: resultado.cambiado,
    evento: resultado.evento
      ? { id: resultado.evento.id, secuencia: Number(resultado.evento.secuencia), ocurrido_en: resultado.evento.ocurrido_en }
      : null,
    acciones_siguientes: accionesRepartidor(d.estado),
    ubicacion_temporal_actualizada: ubicacionTemporal,
  };
}

/** GET /api/seguimiento/repartidores/:codigo/tareas */
async function listarTareas(codigoCrudo) {
  const codigo = validarCodigoRepartidor(codigoCrudo, 'codigo');
  const repartidor = await repositorio.buscarRepartidor(codigo);
  if (!repartidor) throw errores.noEncontrado(`No existe el repartidor ${codigo}.`);
  const tareas = await repositorio.listarTareas(codigo);
  return {
    repartidor: {
      codigo: repartidor.codigo, nombre: repartidor.nombre, activo: repartidor.activo,
      capacidad_maxima: repartidor.capacidad_maxima,
      carga_actual: tareas.length,
      zona: { codigo: repartidor.zona_codigo, nombre: repartidor.zona_nombre },
    },
    tareas: tareas.map((t) => ({
      codigo: t.codigo,
      estado: t.estado,
      acciones: accionesRepartidor(t.estado),
      paquete: { descripcion: t.descripcion, peso_kg: t.peso_kg },
      servicio: t.tipo_nombre,
      origen: { direccion: t.origen_direccion, zona: t.origen_zona_nombre },
      destinatario: t.destinatario_nombre,
      destino: { direccion: t.destino_direccion, zona: t.destino_zona_nombre },
      observaciones: t.observaciones,
      asignada_en: t.asignada_en,
      actualizado_en: t.actualizado_en,
    })),
  };
}

/** GET /api/seguimiento/sincronizador: estado del sincronizador outbox → MongoDB. */
function estadoSincronizador() {
  return sincronizador.resumen();
}

module.exports = { consultar, registrarCambio, listarTareas, estadoSincronizador, accionesRepartidor };
