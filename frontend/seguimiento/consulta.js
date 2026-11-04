// Consulta de seguimiento por código (Dominio 3).
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
//   GET /api/seguimiento/:codigo → estado vigente (PostgreSQL) + línea de tiempo (MongoDB)
// Si el historial va atrasado (outbox pendiente), se vuelve a consultar sola cada 3 s.
import { api, mostrarMensaje } from '/js/api.js';
import { esCodigoValido, normalizarCodigo } from '/envios/envios.js';
import { el, etiquetaEstado, formatearFecha, avisoHistorial, lineaTiempo } from '/seguimiento/seguimiento.js';

const formulario = document.getElementById('buscar');
const entrada = document.getElementById('codigo');
const mensaje = document.getElementById('mensaje');
const resultado = document.getElementById('resultado');

let temporizador = null;
let reintentos = 0;

function dato(nombre, valor, sub) {
  const caja = el('div', 'dato');
  caja.append(el('div', 'dato__nombre', nombre), el('div', 'dato__valor', valor));
  if (sub) caja.append(el('div', 'dato__sub', sub));
  return caja;
}

function pintar(datos) {
  const { envio, historial, repartidor } = datos;

  const vigente = el('section', 'panel');
  const cabecera = el('div', 'seg-cabecera');
  const izquierda = el('div');
  izquierda.append(el('div', 'seg-fuente seg-fuente--pg', 'Estado vigente · PostgreSQL'), el('div', 'seg-codigo', envio.codigo));
  cabecera.append(izquierda, etiquetaEstado(envio.estado));
  const cuerpo = el('div', 'seg-datos');
  cuerpo.style.marginTop = '14px';
  cuerpo.append(
    dato('Origen', envio.origen.zona.nombre),
    dato('Destino', envio.destino.zona.nombre),
    dato('Servicio', envio.tipo_servicio.nombre),
    dato('Repartidor', repartidor ? `${repartidor.codigo} · ${repartidor.nombre}` : 'Sin asignar'),
    dato('Última actualización', formatearFecha(datos.estado_vigente.actualizado_en)),
    dato(envio.estado === 'ENTREGADO' ? 'Entregado' : 'Solicitado',
      formatearFecha(envio.estado === 'ENTREGADO' ? envio.fechas.entregado_en : envio.fechas.creado_en)),
  );
  if (envio.estado === 'CANCELADO' && envio.motivo_cancelacion) {
    const motivo = dato('Motivo de cancelación', envio.motivo_cancelacion);
    motivo.classList.add('dato--ancho');
    cuerpo.append(motivo);
  }
  const enlace = el('a', 'boton boton--secundario', 'Ver detalle completo');
  enlace.href = `/seguimiento/detalle.html?codigo=${encodeURIComponent(envio.codigo)}`;
  const pie = el('div', 'grupo-botones');
  pie.style.marginTop = '16px';
  pie.append(enlace);
  vigente.append(cabecera, cuerpo, pie);

  const linea = el('section', 'panel');
  const titulo = el('h2', 'panel__titulo', 'Línea de tiempo');
  titulo.append(el('span', 'seg-fuente seg-fuente--mongo', 'MongoDB'));
  titulo.lastChild.style.marginLeft = 'auto';
  linea.append(titulo, avisoHistorial(historial), lineaTiempo(historial.eventos));

  const rejilla = el('div', 'seg-rejilla');
  rejilla.append(vigente, linea);
  resultado.replaceChildren(rejilla);
}

async function consultar(codigo, { silencioso = false } = {}) {
  clearTimeout(temporizador);
  if (!silencioso) {
    mensaje.className = 'oculto';
    resultado.replaceChildren(el('p', 'tenue', 'Consultando…'));
  }
  try {
    const datos = await api(`/api/seguimiento/${encodeURIComponent(codigo)}`);
    pintar(datos);
    history.replaceState(null, '', `?codigo=${encodeURIComponent(codigo)}`);
    // Historial atrasado: se reintenta solo (máximo 20 veces, unos 60 s).
    if (!datos.historial.al_dia && reintentos < 20) {
      reintentos += 1;
      temporizador = setTimeout(() => consultar(codigo, { silencioso: true }), 3000);
    }
  } catch (error) {
    if (silencioso) return;
    resultado.replaceChildren();
    mostrarMensaje(mensaje, 'error', error.message, error.detalles);
  }
}

formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const codigo = normalizarCodigo(entrada.value);
  entrada.value = codigo;
  if (!esCodigoValido(codigo)) {
    mostrarMensaje(mensaje, 'error', 'El código debe tener el formato ENV- seguido de 8 caracteres.');
    return;
  }
  reintentos = 0;
  consultar(codigo);
});

const inicial = new URLSearchParams(location.search).get('codigo');
if (inicial) {
  entrada.value = normalizarCodigo(inicial);
  formulario.requestSubmit();
}
