// Funciones compartidas por las pantallas de seguimiento, repartidor y detalle.
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
// Todo el texto que viene de la API se inserta con textContent, nunca como HTML.
import { el, etiquetaEstado, formatearFecha, NOMBRES_ESTADO } from '/envios/envios.js';

export { el, etiquetaEstado, formatearFecha, NOMBRES_ESTADO };

const SVG = 'http://www.w3.org/2000/svg';
const NOMBRES_CONEXION = { EN_LINEA: 'en línea', OCUPADO: 'ocupado', EN_PAUSA: 'en pausa' };

export function icono(d) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const trazo = document.createElementNS(SVG, 'path');
  trazo.setAttribute('d', d);
  svg.append(trazo);
  return svg;
}

export const ICONOS = {
  ok: 'M5 12l5 5 9-10',
  reloj: 'M12 7v5l3 3 M12 21a9 9 0 100-18 9 9 0 000 18z',
  alerta: 'M12 9v4 M12 17h.01 M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  foto: 'M4 7h3l2-3h6l2 3h3v12H4z M12 17a4 4 0 100-8 4 4 0 000 8z',
};

/** Texto legible de quién hizo el cambio. */
export function nombreActor(actor) {
  if (actor === 'CLIENTE') return 'Cliente';
  if (actor === 'OPERADOR') return 'Operador';
  return actor; // REP-NNN
}

/** Resumen en una línea de los datos de un evento. */
export function detalleEvento(evento) {
  const d = evento.datos || {};
  const partes = [];
  if (evento.tipo === 'ASIGNADO' && d.motivo === 'REASIGNACION') {
    partes.push(`Reasignado de ${d.repartidor_anterior} a ${d.repartidor_nuevo}`);
  } else if (d.repartidor_codigo) {
    partes.push(evento.tipo === 'ACEPTADO' ? `Liberado de ${d.repartidor_codigo}` : `Repartidor ${d.repartidor_codigo}`);
  }
  if (d.motivo && d.motivo !== 'REASIGNACION' && d.motivo !== 'LIBERACION_ASIGNACION') partes.push(`Motivo: ${d.motivo}`);
  if (d.observacion) partes.push(d.observacion);
  if (d.ubicacion) partes.push(`Ubicación simulada (${d.ubicacion.x}, ${d.ubicacion.y})`);
  if (d.receptor_tipo) partes.push(`Recibió: ${d.receptor_tipo.toLowerCase()}`);
  if (d.evidencia_id) partes.push('Con evidencia de entrega');
  return partes.join(' · ');
}

/** Aviso sobre el estado del historial (al día, atrasado o no disponible). */
export function avisoHistorial(historial) {
  let clase = 'seg-aviso--ok';
  let texto = `Historial al día: ${historial.eventos.length} de ${historial.eventos_oficiales} eventos copiados a MongoDB.`;
  let trazo = ICONOS.ok;
  if (!historial.disponible) {
    clase = 'seg-aviso--error';
    texto = historial.mensaje;
    trazo = ICONOS.alerta;
  } else if (!historial.al_dia) {
    clase = 'seg-aviso--atrasado';
    texto = `${historial.mensaje} Se actualizará en unos segundos.`;
    trazo = ICONOS.reloj;
  } else if (historial.coherente === false) {
    clase = 'seg-aviso--error';
    texto = 'El último evento no coincide con el estado vigente. Revisa la outbox.';
    trazo = ICONOS.alerta;
  }
  const caja = el('div', `seg-aviso ${clase}`);
  caja.setAttribute('role', 'status');
  caja.append(icono(trazo), el('span', '', texto));
  return caja;
}

/** Línea de tiempo vertical, en el orden de la secuencia. */
export function lineaTiempo(eventos) {
  if (!eventos.length) return el('p', 'tenue', 'Todavía no hay eventos copiados para este envío.');
  const lista = el('ol', 'linea-tiempo');
  lista.setAttribute('aria-label', 'Línea de tiempo del envío');
  eventos.forEach((evento, i) => {
    const item = el('li', i === eventos.length - 1 ? 'ultimo' : '');
    item.dataset.tipo = evento.tipo;
    const fila = el('div', 'linea-tiempo__fila');
    fila.append(
      el('strong', '', NOMBRES_ESTADO[evento.tipo] || evento.tipo),
      el('span', 'linea-tiempo__actor', nombreActor(evento.actor)),
      el('span', 'linea-tiempo__fecha', formatearFecha(evento.ocurrido_en)),
    );
    item.append(el('span', 'linea-tiempo__punto'), fila);
    const detalle = detalleEvento(evento);
    if (detalle) item.append(el('div', 'linea-tiempo__detalle', detalle));
    item.append(el('div', 'linea-tiempo__secuencia', `#${evento.secuencia}`));
    lista.append(item);
  });
  return lista;
}

/** Mini plano ficticio 0–100 con la posición (sin mapas ni coordenadas reales). */
export function plano(x, y) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'plano');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', x === undefined ? 'Plano ficticio sin posición' : `Posición simulada ${x}, ${y} en el plano ficticio`);
  for (let i = 20; i < 100; i += 20) {
    for (const [a, b, c, d] of [[i, 0, i, 100], [0, i, 100, i]]) {
      const linea = document.createElementNS(SVG, 'line');
      linea.setAttribute('x1', a); linea.setAttribute('y1', b); linea.setAttribute('x2', c); linea.setAttribute('y2', d);
      svg.append(linea);
    }
  }
  if (x !== undefined) {
    const punto = document.createElementNS(SVG, 'circle');
    punto.setAttribute('cx', x); punto.setAttribute('cy', 100 - y); punto.setAttribute('r', 6);
    svg.append(punto);
  }
  return svg;
}

/** Bloque del estado temporal (Redis): ubicación y conexión con su TTL. */
export function bloqueTemporal(temporal) {
  const caja = el('div');
  if (!temporal || temporal.disponible === false) {
    caja.append(el('p', 'temporal__vacio', temporal?.mensaje || 'Sin dato vigente.'));
    return caja;
  }
  const { ubicacion, conexion } = temporal;
  const fila = el('div', 'temporal');
  fila.append(plano(ubicacion.vigente ? ubicacion.x : undefined, ubicacion.vigente ? ubicacion.y : undefined));
  const texto = el('div');
  if (ubicacion.vigente) {
    texto.append(
      el('div', '', `Posición simulada: (${ubicacion.x}, ${ubicacion.y})`),
      el('div', 'tenue', `Reportada: ${formatearFecha(ubicacion.registrada_en)}`),
    );
    const ttl = el('div', 'tenue');
    ttl.append('Expira en ', el('span', 'ttl', `${ubicacion.ttl_segundos} s`));
    const barra = el('div', 'barra-ttl');
    const relleno = el('span');
    relleno.style.width = `${Math.round((ubicacion.ttl_segundos / ubicacion.ttl_maximo_segundos) * 100)}%`;
    barra.append(relleno);
    texto.append(ttl, barra);
  } else {
    texto.append(el('div', 'temporal__vacio', 'Ubicación: sin dato vigente'));
  }
  texto.append(el('div', conexion.vigente ? '' : 'temporal__vacio',
    conexion.vigente ? `Conexión: ${NOMBRES_CONEXION[conexion.estado] || conexion.estado} (expira en ${conexion.ttl_segundos} s)` : 'Conexión: sin dato vigente'));
  fila.append(texto);
  caja.append(fila);
  return caja;
}

/** Tarjeta de la evidencia de entrega (MongoDB), confirmada por PostgreSQL. */
export function bloqueEvidencia(evidencia) {
  const caja = el('div', 'seg-datos');
  if (!evidencia) {
    caja.append(el('p', 'tenue dato--ancho', 'Sin evidencia: el envío aún no se entrega.'));
    return caja;
  }
  if (evidencia.disponible === false) {
    caja.append(el('p', 'dato--ancho', evidencia.mensaje || 'Entrega confirmada; el detalle de la evidencia no está disponible ahora.'));
    return caja;
  }
  const dato = (nombre, valor, ancho) => {
    const d = el('div', ancho ? 'dato dato--ancho' : 'dato');
    d.append(el('div', 'dato__nombre', nombre), el('div', 'dato__valor', valor));
    return d;
  };
  const r = evidencia.receptor;
  caja.append(
    dato('Recibió', `${r.nombre} (${r.tipo.toLowerCase()})`),
    dato('Relación / documento', [r.relacion, r.documento].filter(Boolean).join(' · ') || '—'),
    dato('Repartidor', evidencia.repartidor),
    dato('Registrada', formatearFecha(evidencia.registrada_en)),
  );
  if (evidencia.observacion) caja.append(dato('Observación', evidencia.observacion, true));
  const foto = el('div', 'evidencia__foto dato--ancho');
  foto.append(icono(ICONOS.foto), el('span', '', `Foto simulada (${evidencia.foto.tipo === 'URL' ? 'URL' : 'referencia'}): ${evidencia.foto.valor}`));
  caja.append(foto);
  caja.append(dato('Clave de evidencia', evidencia.clave_evidencia, true));
  return caja;
}

/** UUID v4 para la clave de evidencia (mismo respaldo que envios.js). */
export { nuevaClave } from '/envios/envios.js';
