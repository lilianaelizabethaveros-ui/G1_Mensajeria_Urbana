
'use strict';

import { api, mostrarMensaje } from '/js/api.js';

const formulario = document.getElementById('form-consulta');
const tabla = document.getElementById('resultados-consulta');
const resumen = document.getElementById('resumen-consulta');
const mensaje = document.getElementById('mensaje');
const indicadorPagina = document.getElementById('indicador-pagina');
const botonAnterior = document.getElementById('pagina-anterior');
const botonSiguiente = document.getElementById('pagina-siguiente');
const botonBuscar = document.getElementById('buscar');
const botonLimpiar = document.getElementById('limpiar');

let paginaActual = 1;
let totalPaginas = 0;
let cargando = false;
let numeroSolicitud = 0;
const limite = 20;

// Mostrar una notificación usando el componente compartido.
function notificar(tipo, texto) {
  mostrarMensaje(mensaje, tipo, texto);
}

// Formatear la fecha para mostrarla al operador.
function formatearFecha(valor) {
  if (!valor) return '—';

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) return '—';

  return fecha.toLocaleString('es-EC', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

// Crear una celda utilizando texto seguro.
function agregarCelda(fila, valor) {
  const celda = document.createElement('td');
  celda.textContent = valor ?? '—';
  fila.append(celda);
}

// Mostrar un mensaje cuando no hay registros.
function mostrarFilaVacia(texto) {
  tabla.replaceChildren();

  const fila = document.createElement('tr');
  const celda = document.createElement('td');

  celda.colSpan = 8;
  celda.textContent = texto;

  fila.append(celda);
  tabla.append(fila);
}

// Obtener los filtros elegidos por el operador.
function obtenerFiltros() {
  const datos = new FormData(formulario);
  const parametros = new URLSearchParams();

  for (const [campo, valor] of datos.entries()) {
    const texto = String(valor).trim();

    if (texto) {
      parametros.set(campo, texto);
    }
  }

  parametros.set('pagina', String(paginaActual));
  parametros.set('limite', String(limite));

  return parametros;
}

// Crear las filas de la tabla.
function mostrarResultados(resultados) {
  tabla.replaceChildren();

  if (!resultados.length) {
    mostrarFilaVacia('No se encontraron envíos con los filtros seleccionados.');
    return;
  }

  for (const envio of resultados) {
    const fila = document.createElement('tr');

    agregarCelda(fila, envio.codigo);
    agregarCelda(fila, envio.estado);
    agregarCelda(fila, envio.origen_zona);
    agregarCelda(fila, envio.destino_zona);
    agregarCelda(fila, envio.destinatario_nombre);
    agregarCelda(fila, envio.repartidor_nombre || 'Sin asignar');
    agregarCelda(fila, formatearFecha(envio.creado_en));

    const celdaDetalle = document.createElement('td');
    const enlace = document.createElement('a');

    enlace.href = `/envios/consulta.html?codigo=${encodeURIComponent(envio.codigo)}`;
    enlace.textContent = 'Ver envío';

    celdaDetalle.append(enlace);
    fila.append(celdaDetalle);

    tabla.append(fila);
  }
}

// Actualizar el resumen y los botones de paginación.
function actualizarPaginacion(paginacion) {
  paginaActual = paginacion.pagina;
  totalPaginas = paginacion.total_paginas;

  const paginasVisibles = Math.max(1, totalPaginas);

  resumen.textContent =
    `${paginacion.total} envío(s) encontrado(s).`;

  indicadorPagina.textContent =
    `Página ${paginaActual} de ${paginasVisibles}`;

  botonAnterior.disabled = cargando || paginaActual <= 1;
  botonSiguiente.disabled = cargando || paginaActual >= totalPaginas;
}

// Consultar la API utilizando los filtros actuales.
async function buscarEnvios() {
  const solicitudActual = ++numeroSolicitud;

  cargando = true;
  botonBuscar.disabled = true;
  botonAnterior.disabled = true;
  botonSiguiente.disabled = true;
  resumen.textContent = 'Buscando envíos...';

  try {
    const parametros = obtenerFiltros();

    const respuesta = await api(
      `/api/consulta?${parametros.toString()}`
    );

    // Ignorar respuestas antiguas si se inició una búsqueda nueva.
    if (solicitudActual !== numeroSolicitud) return;

    const resultados = respuesta.resultados;
    const paginacion = respuesta.paginacion;

    mostrarResultados(resultados);
    actualizarPaginacion(paginacion);
  } catch (error) {
    if (solicitudActual !== numeroSolicitud) return;

    mostrarFilaVacia('No fue posible completar la consulta.');
    resumen.textContent = 'Error al consultar los envíos.';
    notificar('mensaje--error', error.message);
  } finally {
    if (solicitudActual === numeroSolicitud) {
      cargando = false;
      botonBuscar.disabled = false;
      botonAnterior.disabled = paginaActual <= 1;
      botonSiguiente.disabled = paginaActual >= totalPaginas;
    }
  }
}

// Cargar las zonas existentes desde el catálogo.
async function cargarZonas() {
  const catalogos = await api('/api/catalogos');
  const selector = document.getElementById('zona');

  for (const zona of catalogos.zonas) {
    const opcion = document.createElement('option');

    opcion.value = zona.codigo;
    opcion.textContent = `${zona.codigo} - ${zona.nombre}`;

    selector.append(opcion);
  }
}

// Buscar desde la primera página al enviar el formulario.
formulario.addEventListener('submit', evento => {
  evento.preventDefault();
  paginaActual = 1;
  buscarEnvios();
});

// Limpiar los filtros y mostrar todos los envíos.
botonLimpiar.addEventListener('click', () => {
  formulario.reset();
  paginaActual = 1;
  buscarEnvios();
});

// Mostrar la página anterior.
botonAnterior.addEventListener('click', () => {
  if (!cargando && paginaActual > 1) {
    paginaActual--;
    buscarEnvios();
  }
});

// Mostrar la página siguiente.
botonSiguiente.addEventListener('click', () => {
  if (!cargando && paginaActual < totalPaginas) {
    paginaActual++;
    buscarEnvios();
  }
});

// Inicializar la pantalla con zonas y envíos registrados.
async function iniciar() {
  try {
    await cargarZonas();
  } catch (error) {
    notificar('mensaje--error', 'No se pudieron cargar las zonas: ' + error.message);
  }

  await buscarEnvios();
}

iniciar();
