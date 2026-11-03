// Reglas de negocio del Dominio 1 (solicitudes y envíos).
//
// - Cada escritura se hace en UNA transacción local de PostgreSQL que también
//   registra el evento en la outbox (decisión D9): ambos se guardan o ninguno.
// - Los cambios de estado pasan por la máquina de estados compartida.
// - Repetir una operación ya aplicada no la duplica (idempotencia).
const { conTransaccion } = require('../../db/postgres');
const { registrarEvento } = require('../../shared/outbox');
const { generarCodigoEnvio } = require('../../shared/identificadores');
const { ESTADOS, TRANSICIONES, validarTransicion } = require('../../shared/estados');
const { errores } = require('../../shared/errores');
const catalogos = require('../catalogos/catalogos.repository');
const repositorio = require('./envios.repository');

const INTENTOS_CODIGO = 5;

/** Convierte la fila de PostgreSQL en el contrato público del envío. */
function aEnvioPublico(f) {
  const entregaEstimada = new Date(new Date(f.creado_en).getTime() + f.tiempo_estimado_horas * 3600 * 1000);
  return {
    codigo: f.codigo,
    estado: f.estado,
    tipo_servicio: { codigo: f.tipo_codigo, nombre: f.tipo_nombre, tiempo_estimado_horas: f.tiempo_estimado_horas },
    remitente: { nombre: f.remitente_nombre, telefono: f.remitente_telefono },
    origen: { direccion: f.origen_direccion, zona: { codigo: f.origen_zona_codigo, nombre: f.origen_zona_nombre } },
    destinatario: { nombre: f.destinatario_nombre, telefono: f.destinatario_telefono },
    destino: { direccion: f.destino_direccion, zona: { codigo: f.destino_zona_codigo, nombre: f.destino_zona_nombre } },
    paquete: { descripcion: f.descripcion, peso_kg: f.peso_kg },
    observaciones: f.observaciones,
    entrega_estimada: f.estado === ESTADOS.CANCELADO ? null : entregaEstimada.toISOString(),
    motivo_cancelacion: f.motivo_cancelacion,
    fechas: {
      creado_en: f.creado_en, actualizado_en: f.actualizado_en,
      aceptado_en: f.aceptado_en, cancelado_en: f.cancelado_en,
    },
    transiciones_permitidas: TRANSICIONES[f.estado],
  };
}

async function obtenerFilaOFallar(codigo, cliente) {
  const fila = await repositorio.buscarPorCodigo(codigo, cliente);
  if (!fila) throw errores.noEncontrado(`No existe un envío con el código ${codigo}.`);
  return fila;
}

/** Comprueba en el catálogo oficial lo que el navegador no puede decidir. */
async function resolverCatalogos(datos) {
  const [origen, destino, tipo] = await Promise.all([
    catalogos.buscarZonaActiva(datos.origen_zona),
    catalogos.buscarZonaActiva(datos.destino_zona),
    catalogos.buscarTipoServicioActivo(datos.tipo_servicio),
  ]);
  const detalles = [];
  if (!origen) detalles.push({ campo: 'origen_zona', mensaje: `La zona ${datos.origen_zona} no existe o no está activa.` });
  if (!destino) detalles.push({ campo: 'destino_zona', mensaje: `La zona ${datos.destino_zona} no existe o no está activa.` });
  if (!tipo) detalles.push({ campo: 'tipo_servicio', mensaje: `El tipo de servicio ${datos.tipo_servicio} no existe o no está activo.` });
  if (tipo && datos.peso_kg > tipo.peso_maximo_kg) {
    detalles.push({ campo: 'peso_kg', mensaje: `El servicio ${tipo.nombre} admite como máximo ${tipo.peso_maximo_kg} kg.` });
  }
  if (origen && destino && origen.id === destino.id
      && datos.origen_direccion.toLowerCase() === datos.destino_direccion.toLowerCase()) {
    detalles.push({ campo: 'destino_direccion', mensaje: 'El destino no puede ser igual al origen.' });
  }
  if (detalles.length) throw errores.validacion(detalles);
  return { origen, destino, tipo };
}

/**
 * Registra una solicitud. Devuelve { envio, creado }:
 *   creado = false si la misma clave de idempotencia ya había creado un envío.
 */
async function registrarSolicitud(datos, claveIdempotencia) {
  if (claveIdempotencia) {
    const previo = await repositorio.buscarPorClaveIdempotencia(claveIdempotencia);
    if (previo) return { envio: aEnvioPublico(previo), creado: false };
  }

  const { origen, destino, tipo } = await resolverCatalogos(datos);

  for (let intento = 1; intento <= INTENTOS_CODIGO; intento += 1) {
    const codigo = generarCodigoEnvio();
    try {
      const fila = await conTransaccion(async (cliente) => {
        await repositorio.insertar(cliente, {
          ...datos,
          codigo,
          tipoServicioId: tipo.id,
          origenZonaId: origen.id,
          destinoZonaId: destino.id,
          claveIdempotencia,
        });
        await registrarEvento(cliente, {
          codigoEnvio: codigo,
          tipo: ESTADOS.CREADO,
          actor: 'CLIENTE',
          datos: { tipo_servicio: tipo.codigo, origen_zona: origen.codigo, destino_zona: destino.codigo },
        });
        return repositorio.buscarPorCodigo(codigo, cliente);
      });
      return { envio: aEnvioPublico(fila), creado: true };
    } catch (error) {
      if (error.code !== '23505') throw error;
      // Otra petición con la misma clave ganó la carrera: devolver ese envío.
      if (error.constraint === 'envios_clave_idempotencia_key') {
        const previo = await repositorio.buscarPorClaveIdempotencia(claveIdempotencia);
        return { envio: aEnvioPublico(previo), creado: false };
      }
      // Código repetido (muy improbable): se genera otro y se reintenta.
      if (error.constraint !== 'envios_codigo_key') throw error;
    }
  }
  throw new Error(`No se pudo generar un código único tras ${INTENTOS_CODIGO} intentos`);
}

async function consultar(codigo) {
  return aEnvioPublico(await obtenerFilaOFallar(codigo));
}

/**
 * Cambio de estado del Dominio 1, con bloqueo de fila e idempotencia.
 * - Si el envío YA está en el estado destino, responde sin cambios y sin evento nuevo.
 * - `desde` limita los estados de origen que este dominio puede cambiar.
 */
async function cambiarEstado(codigo, destino, { actor, desde, aplicar, datosEvento = {} }) {
  return conTransaccion(async (cliente) => {
    const actual = await repositorio.bloquearPorCodigo(cliente, codigo);
    if (!actual) throw errores.noEncontrado(`No existe un envío con el código ${codigo}.`);

    if (actual.estado === destino) {
      return { envio: aEnvioPublico(await obtenerFilaOFallar(codigo, cliente)), cambiado: false };
    }
    if (desde && !desde.includes(actual.estado)) {
      throw errores.conflicto('TRANSICION_INVALIDA',
        `No se puede pasar de ${actual.estado} a ${destino} desde las solicitudes. `
        + `Solo se permite desde: ${desde.join(', ')}.`);
    }
    validarTransicion(actual.estado, destino);

    await aplicar(cliente, actual.id);
    await registrarEvento(cliente, {
      codigoEnvio: codigo,
      tipo: destino,
      actor,
      datos: { estado_anterior: actual.estado, ...datosEvento },
    });
    return { envio: aEnvioPublico(await obtenerFilaOFallar(codigo, cliente)), cambiado: true };
  });
}

/** El operador valida la solicitud: CREADO → ACEPTADO. */
function aceptar(codigo) {
  return cambiarEstado(codigo, ESTADOS.ACEPTADO, {
    actor: 'OPERADOR',
    desde: [ESTADOS.CREADO],
    aplicar: (cliente, id) => repositorio.marcarAceptado(cliente, id),
  });
}

/**
 * Cancelación desde la solicitud: solo CREADO o ACEPTADO. Un envío ya ASIGNADO
 * primero debe liberarse en despacho (propuesta P3, pendiente de acuerdo).
 */
function cancelar(codigo, { motivo, actor }) {
  return cambiarEstado(codigo, ESTADOS.CANCELADO, {
    actor,
    desde: [ESTADOS.CREADO, ESTADOS.ACEPTADO],
    aplicar: (cliente, id) => repositorio.marcarCancelado(cliente, id, motivo),
    datosEvento: { motivo },
  });
}

module.exports = { registrarSolicitud, consultar, aceptar, cancelar, aEnvioPublico };
