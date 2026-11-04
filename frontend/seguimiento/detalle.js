// Detalle de envío: estado vigente, historial, evidencia y comprobación entre gestores.
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
//   GET /api/seguimiento/:codigo (una sola llamada: la API reúne PostgreSQL, MongoDB y Redis)
import { api, mostrarMensaje } from '/js/api.js';
import { esCodigoValido, normalizarCodigo } from '/envios/envios.js';
import {
  el, etiquetaEstado, formatearFecha, avisoHistorial, lineaTiempo, bloqueEvidencia, bloqueTemporal, NOMBRES_ESTADO,
} from '/seguimiento/seguimiento.js';

const formulario = document.getElementById('buscar');
const entrada = document.getElementById('codigo');
const mensaje = document.getElementById('mensaje');
const resultado = document.getElementById('resultado');

function dato(nombre, valor, sub, ancho = false) {
  const caja = el('div', ancho ? 'dato dato--ancho' : 'dato');
  caja.append(el('div', 'dato__nombre', nombre), el('div', 'dato__valor', valor ?? '—'));
  if (sub) caja.append(el('div', 'dato__sub', sub));
  return caja;
}

function panel(titulo, fuente, claseFuente, ...contenido) {
  const seccion = el('section', 'panel');
  const h = el('h2', 'panel__titulo', titulo);
  if (fuente) {
    const f = el('span', `seg-fuente ${claseFuente}`, fuente);
    f.style.marginLeft = 'auto';
    h.append(f);
  }
  seccion.append(h, ...contenido);
  return seccion;
}

function tablaConsistencia(datos) {
  const { historial, envio, evidencia } = datos;
  const ultimo = historial.eventos.at(-1);
  const filas = [
    ['Eventos registrados (outbox)', 'PostgreSQL', String(historial.eventos_oficiales)],
    ['Eventos copiados (eventos)', 'MongoDB', historial.disponible ? String(historial.eventos.length) : 'no disponible'],
    ['Pendientes de sincronizar', 'PostgreSQL', String(historial.pendientes_sincronizar)],
    ['Estado vigente', 'PostgreSQL', NOMBRES_ESTADO[envio.estado]],
    ['Último evento del historial', 'MongoDB', ultimo ? NOMBRES_ESTADO[ultimo.tipo] || ultimo.tipo : '—'],
    ['Evidencia referenciada', 'PostgreSQL → MongoDB', envio.evidencia_id ? (evidencia?.disponible === false ? 'sí (detalle no disponible)' : 'sí') : 'no'],
  ];
  const tabla = el('table', 'consistencia');
  const cabecera = el('tr');
  ['Comprobación', 'Gestor', 'Valor'].forEach((t) => cabecera.append(el('th', '', t)));
  const thead = el('thead');
  thead.append(cabecera);
  const tbody = el('tbody');
  for (const fila of filas) {
    const tr = el('tr');
    fila.forEach((c) => tr.append(el('td', '', c)));
    tbody.append(tr);
  }
  tabla.append(thead, tbody);
  let veredicto = 'Coherente: el estado vigente coincide con el último evento y no faltan eventos.';
  let clase = 'seg-aviso seg-aviso--ok';
  if (!historial.disponible) {
    veredicto = 'MongoDB no responde: el estado vigente es oficial y el historial se completará cuando vuelva.';
    clase = 'seg-aviso seg-aviso--error';
  } else if (!historial.al_dia) {
    veredicto = 'Historial atrasado: hay eventos en la outbox que el sincronizador aún no copia.';
    clase = 'seg-aviso seg-aviso--atrasado';
  } else if (historial.coherente === false) {
    veredicto = 'Incoherencia: el último evento no coincide con el estado vigente.';
    clase = 'seg-aviso seg-aviso--error';
  }
  const caja = el('div');
  caja.append(el('div', clase, veredicto), tabla);
  return caja;
}

function pintar(datos) {
  const { envio, repartidor, historial } = datos;

  // Estado vigente y datos del envío (PostgreSQL)
  const cabecera = el('div', 'seg-cabecera');
  cabecera.append(el('div', 'seg-codigo', envio.codigo), etiquetaEstado(envio.estado));
  const cuerpo = el('div', 'seg-datos');
  cuerpo.style.marginTop = '14px';
  cuerpo.append(
    dato('Remitente', envio.remitente.nombre),
    dato('Destinatario', envio.destinatario.nombre),
    dato('Origen', envio.origen.direccion, envio.origen.zona.nombre),
    dato('Destino', envio.destino.direccion, envio.destino.zona.nombre),
    dato('Paquete', envio.paquete.descripcion, `${envio.paquete.peso_kg} kg`),
    dato('Servicio', envio.tipo_servicio.nombre),
    dato('Solicitado', formatearFecha(envio.fechas.creado_en)),
    dato('Última actualización', formatearFecha(envio.fechas.actualizado_en)),
  );
  if (envio.fechas.entregado_en) cuerpo.append(dato('Entregado', formatearFecha(envio.fechas.entregado_en)));
  if (envio.estado === 'CANCELADO') cuerpo.append(dato('Cancelado', formatearFecha(envio.fechas.cancelado_en), envio.motivo_cancelacion));
  if (envio.observaciones) cuerpo.append(dato('Observaciones', envio.observaciones, null, true));
  const principal = panel('Estado vigente', 'PostgreSQL', 'seg-fuente--pg', cabecera, cuerpo);

  // Repartidor y estado temporal (PostgreSQL + Redis)
  const rep = el('div', 'seg-datos');
  if (repartidor) {
    rep.append(
      dato('Repartidor', `${repartidor.codigo} · ${repartidor.nombre}`),
      dato('Asignación', repartidor.activa ? 'Activa' : 'Liberada',
        repartidor.activa ? `Desde ${formatearFecha(repartidor.asignada_en)}` : `Liberada ${formatearFecha(repartidor.liberada_en)}`),
    );
  } else {
    rep.append(el('p', 'tenue dato--ancho', 'Sin repartidor asignado.'));
  }
  const panelRep = panel('Repartidor', 'PostgreSQL', 'seg-fuente--pg', rep);
  if (datos.estado_temporal) {
    const sub = el('div');
    sub.style.marginTop = '14px';
    const t = el('div', 'seg-fuente seg-fuente--redis', 'Ubicación temporal · Redis (no es prueba de entrega)');
    t.style.marginBottom = '8px';
    sub.append(t, bloqueTemporal(datos.estado_temporal));
    panelRep.append(sub);
  }

  const panelEvidencia = panel('Evidencia de entrega', 'MongoDB', 'seg-fuente--mongo', bloqueEvidencia(datos.evidencia));
  const panelHistorial = panel('Historial completo', 'MongoDB', 'seg-fuente--mongo', avisoHistorial(historial), lineaTiempo(historial.eventos));
  const panelConsistencia = panel('Consistencia entre gestores', null, '', tablaConsistencia(datos));

  const izquierda = el('div', 'seg-pila');
  izquierda.append(principal, panelRep, panelEvidencia);
  const derecha = el('div', 'seg-pila');
  derecha.append(panelHistorial, panelConsistencia);
  const rejilla = el('div', 'seg-rejilla');
  rejilla.append(izquierda, derecha);
  resultado.replaceChildren(rejilla);
}

async function consultar(codigo) {
  mensaje.className = 'oculto';
  resultado.replaceChildren(el('p', 'tenue', 'Consultando…'));
  try {
    pintar(await api(`/api/seguimiento/${encodeURIComponent(codigo)}`));
    history.replaceState(null, '', `?codigo=${encodeURIComponent(codigo)}`);
  } catch (error) {
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
  consultar(codigo);
});

const inicial = new URLSearchParams(location.search).get('codigo');
if (inicial) {
  entrada.value = normalizarCodigo(inicial);
  consultar(entrada.value);
}
