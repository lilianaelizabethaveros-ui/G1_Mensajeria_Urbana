// Funciones compartidas por las pantallas del Dominio 1 (Liliana Averos).
// Todo el contenido que viene de la API se inserta con textContent, nunca como HTML.

export const NOMBRES_ESTADO = {
  CREADO: 'Creado',
  ACEPTADO: 'Aceptado',
  ASIGNADO: 'Asignado',
  RETIRADO: 'Retirado',
  EN_TRANSITO: 'En tránsito',
  INCIDENCIA: 'Incidencia',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

// Camino normal del envío; INCIDENCIA y CANCELADO se muestran aparte.
const PASOS = ['CREADO', 'ACEPTADO', 'ASIGNADO', 'RETIRADO', 'EN_TRANSITO', 'ENTREGADO'];

const PATRON_CODIGO = /^ENV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

export function normalizarCodigo(valor) {
  return String(valor ?? '').trim().toUpperCase();
}

export function esCodigoValido(valor) {
  return PATRON_CODIGO.test(normalizarCodigo(valor));
}

/** Crea un elemento con clase y texto (el texto siempre como textContent). */
export function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = String(texto);
  return nodo;
}

const formatoFecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
export function formatearFecha(iso) {
  return iso ? formatoFecha.format(new Date(iso)) : '—';
}

export function etiquetaEstado(estado) {
  return el('span', `estado-envio estado-envio--${estado}`, NOMBRES_ESTADO[estado] || estado);
}

function dato(nombre, valor, sub, ancho = false) {
  const caja = el('div', ancho ? 'dato dato--ancho' : 'dato');
  caja.append(el('div', 'dato__nombre', nombre), el('div', 'dato__valor', valor));
  if (sub) caja.append(el('div', 'dato__sub', sub));
  return caja;
}

function progreso(estado) {
  const lista = el('ol', 'progreso');
  lista.setAttribute('aria-label', 'Avance del envío');
  // Una incidencia ocurre después del retiro: se marca en la posición "En tránsito".
  const posicion = estado === 'INCIDENCIA' ? PASOS.indexOf('EN_TRANSITO') : PASOS.indexOf(estado);
  PASOS.forEach((paso, i) => {
    const texto = i === posicion && estado === 'INCIDENCIA' ? NOMBRES_ESTADO.INCIDENCIA : NOMBRES_ESTADO[paso];
    const item = el('li', '', texto);
    if (i < posicion) item.classList.add('hecho');
    if (i === posicion) {
      item.classList.add('actual');
      item.setAttribute('aria-current', 'step');
    }
    lista.append(item);
  });
  return lista;
}

/**
 * Dibuja el comprobante de un envío dentro de `contenedor`.
 * `acciones` (opcional) son botones que se agregan al pie.
 */
export function pintarComprobante(contenedor, envio, acciones = []) {
  const tarjeta = el('article', 'panel comprobante');
  tarjeta.setAttribute('aria-label', `Comprobante del envío ${envio.codigo}`);

  // Cabecera: código grande y estado
  const cabecera = el('div', 'comprobante__cabecera');
  const izquierda = el('div');
  izquierda.append(el('div', 'comprobante__etiqueta', 'Código de seguimiento'));
  const codigo = el('div', 'comprobante__codigo', envio.codigo);
  codigo.id = 'codigo-envio';
  izquierda.append(codigo);
  cabecera.append(izquierda, etiquetaEstado(envio.estado));
  tarjeta.append(cabecera);

  // Cuerpo: datos del envío
  const cuerpo = el('div', 'comprobante__cuerpo');
  if (envio.estado !== 'CANCELADO') {
    const caja = el('div', 'dato dato--ancho');
    caja.append(progreso(envio.estado));
    cuerpo.append(caja);
  }
  cuerpo.append(
    dato('Remitente', envio.remitente.nombre, envio.remitente.telefono),
    dato('Destinatario', envio.destinatario.nombre, envio.destinatario.telefono),
    dato('Origen', envio.origen.direccion, envio.origen.zona.nombre),
    dato('Destino', envio.destino.direccion, envio.destino.zona.nombre),
    dato('Paquete', envio.paquete.descripcion, `${envio.paquete.peso_kg} kg`),
    dato('Servicio', envio.tipo_servicio.nombre, `Tiempo estimado: ${envio.tipo_servicio.tiempo_estimado_horas} h`),
    dato('Solicitado', formatearFecha(envio.fechas.creado_en)),
    envio.estado === 'CANCELADO'
      ? dato('Cancelado', formatearFecha(envio.fechas.cancelado_en), envio.motivo_cancelacion)
      : dato('Entrega estimada', formatearFecha(envio.entrega_estimada),
        envio.fechas.aceptado_en ? `Aceptado: ${formatearFecha(envio.fechas.aceptado_en)}` : 'Pendiente de aceptación'),
  );
  if (envio.observaciones) cuerpo.append(dato('Observaciones', envio.observaciones, null, true));
  tarjeta.append(cuerpo);

  // Pie: acciones
  const pie = el('div', 'comprobante__pie no-imprimir');
  pie.append(el('span', 'tenue', 'Datos ficticios · Proyecto B · Grupo 1'));
  const grupo = el('div', 'grupo-botones');
  grupo.append(...acciones);
  pie.append(grupo);
  tarjeta.append(pie);

  contenedor.replaceChildren(tarjeta);
  return tarjeta;
}

/** Botón con un icono SVG (trazo) y texto. */
export function boton(texto, { clase = 'boton', icono, tipo = 'button' } = {}) {
  const b = el('button', clase);
  b.type = tipo;
  if (icono) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trazo.setAttribute('d', icono);
    svg.append(trazo);
    b.append(svg);
  }
  b.append(texto);
  return b;
}

export const ICONOS = {
  copiar: 'M9 9h10v12H9z M5 15H4V3h12v1',
  imprimir: 'M6 9V3h12v6 M6 18H4v-7h16v7h-2 M7 14h10v7H7z',
  nuevo: 'M12 5v14M5 12h14',
  buscar: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  aceptar: 'M5 12l5 5 9-10',
  cancelar: 'M6 6l12 12M18 6L6 18',
};

/** Botón "Copiar código" con confirmación visual. */
export function botonCopiar(codigo) {
  const b = boton('Copiar código', { clase: 'boton boton--secundario', icono: ICONOS.copiar });
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      b.lastChild.textContent = '¡Copiado!';
    } catch {
      // Sin permiso de portapapeles: se selecciona el código para copiarlo a mano.
      const nodo = document.getElementById('codigo-envio');
      const rango = document.createRange();
      rango.selectNodeContents(nodo);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(rango);
      b.lastChild.textContent = 'Selecciona y copia (Ctrl+C)';
    }
    setTimeout(() => { b.lastChild.textContent = 'Copiar código'; }, 2500);
  });
  return b;
}

export function botonImprimir() {
  const b = boton('Imprimir', { clase: 'boton boton--secundario', icono: ICONOS.imprimir });
  b.addEventListener('click', () => window.print());
  return b;
}

/** Clave de idempotencia por formulario (D: reintento seguro). */
export function nuevaClave() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Respaldo para navegadores sin randomUUID: UUID v4 con getRandomValues.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
