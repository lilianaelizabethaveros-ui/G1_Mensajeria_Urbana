
'use strict';

const repositorio = require('./consulta.repository');
const { errores } = require('../../shared/errores');

// Estados permitidos para las búsquedas.
const ESTADOS_VALIDOS = [
  'CREADO',
  'ACEPTADO',
  'ASIGNADO',
  'RETIRADO',
  'EN_RUTA',
  'ENTREGADO',
  'CANCELADO'
];

// Limpiar los valores recibidos como texto.
function limpiarTexto(valor) {
  if (typeof valor !== 'string') {
    return '';
  }

  return valor.trim();
}

// Comprobar el formato y la existencia de una fecha.
function esFechaValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

// Validar los filtros de la consulta operativa.
function validarFiltros(consulta = {}) {
  const filtros = {
    codigo: limpiarTexto(consulta.codigo).toUpperCase(),
    zona: limpiarTexto(consulta.zona).toUpperCase(),
    estado: limpiarTexto(consulta.estado).toUpperCase(),
    destinatario: limpiarTexto(consulta.destinatario),
    fecha_desde: limpiarTexto(consulta.fecha_desde),
    fecha_hasta: limpiarTexto(consulta.fecha_hasta),
    pagina: 1,
    limite: 20
  };

  const detalles = [];

  // Validar el código del envío.
  if (filtros.codigo.length > 12) {
    detalles.push({
      campo: 'codigo',
      mensaje: 'El código no puede superar 12 caracteres.'
    });
  }

  if (
    filtros.codigo &&
    !/^[A-Z0-9-]+$/.test(filtros.codigo)
  ) {
    detalles.push({
      campo: 'codigo',
      mensaje: 'El código contiene caracteres no permitidos.'
    });
  }

  // Validar la zona.
  if (
    filtros.zona &&
    !/^[A-Z0-9_]{2,10}$/.test(filtros.zona)
  ) {
    detalles.push({
      campo: 'zona',
      mensaje: 'El código de zona no es válido.'
    });
  }

  // Validar el estado.
  if (
    filtros.estado &&
    !ESTADOS_VALIDOS.includes(filtros.estado)
  ) {
    detalles.push({
      campo: 'estado',
      mensaje: 'El estado indicado no es válido.'
    });
  }

  // Validar el nombre del destinatario.
  if (filtros.destinatario.length > 80) {
    detalles.push({
      campo: 'destinatario',
      mensaje: 'El destinatario no puede superar 80 caracteres.'
    });
  }

  // Validar la fecha inicial.
  if (
    filtros.fecha_desde &&
    !esFechaValida(filtros.fecha_desde)
  ) {
    detalles.push({
      campo: 'fecha_desde',
      mensaje: 'La fecha inicial debe ser válida y tener formato AAAA-MM-DD.'
    });
  }

  // Validar la fecha final.
  if (
    filtros.fecha_hasta &&
    !esFechaValida(filtros.fecha_hasta)
  ) {
    detalles.push({
      campo: 'fecha_hasta',
      mensaje: 'La fecha final debe ser válida y tener formato AAAA-MM-DD.'
    });
  }

  // Validar el orden del rango de fechas.
  if (
    esFechaValida(filtros.fecha_desde) &&
    esFechaValida(filtros.fecha_hasta) &&
    filtros.fecha_desde > filtros.fecha_hasta
  ) {
    detalles.push({
      campo: 'fecha_hasta',
      mensaje: 'La fecha final no puede ser anterior a la fecha inicial.'
    });
  }

  // Validar el número de página.
  if (consulta.pagina !== undefined) {
    const paginaTexto = String(consulta.pagina);

    if (
      !/^[1-9]\d*$/.test(paginaTexto) ||
      !Number.isSafeInteger(Number(paginaTexto))
    ) {
      detalles.push({
        campo: 'pagina',
        mensaje: 'La página debe ser un entero mayor que cero.'
      });
    } else {
      filtros.pagina = Number(paginaTexto);
    }
  }

  // Validar la cantidad de resultados por página.
  if (consulta.limite !== undefined) {
    const limiteTexto = String(consulta.limite);

    if (
      !/^[1-9]\d*$/.test(limiteTexto) ||
      !Number.isSafeInteger(Number(limiteTexto)) ||
      Number(limiteTexto) > 100
    ) {
      detalles.push({
        campo: 'limite',
        mensaje: 'El límite debe ser un entero entre 1 y 100.'
      });
    } else {
      filtros.limite = Number(limiteTexto);
    }
  }

  // Responder HTTP 400 cuando los filtros no sean válidos.
  if (detalles.length > 0) {
    throw errores.validacion(detalles);
  }

  return filtros;
}

// Buscar los envíos y devolver los datos de paginación.
async function buscarEnvios(consulta = {}) {
  const filtros = validarFiltros(consulta);

  const { resultados, total } =
    await repositorio.buscarEnvios(filtros);

  const totalPaginas = Math.ceil(total / filtros.limite);

  return {
    resultados,
    paginacion: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      total_paginas: totalPaginas
    }
  };
}

module.exports = {
  validarFiltros,
  buscarEnvios
};
