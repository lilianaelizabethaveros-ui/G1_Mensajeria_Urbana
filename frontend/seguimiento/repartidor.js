// Vista del repartidor (Dominios 3, 4 y 6).
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
//   GET   /api/despacho/repartidores                     lista de repartidores (Camila)
//   GET   /api/seguimiento/repartidores/:rep/tareas      envíos en curso y acciones permitidas
//   POST  /api/seguimiento/:codigo/eventos               retiro, tránsito, incidencia, cancelación
//   POST  /api/evidencias                                entrega con evidencia (clave_evidencia)
//   GET/PUT/PATCH /api/estado-temporal/repartidores/:rep ubicación y conexión con TTL (Redis)
// La API decide si cada cambio es válido; los botones solo muestran lo que el estado permite.
import { api, mostrarMensaje } from '/js/api.js';
import { el, etiquetaEstado, formatearFecha, bloqueTemporal, nuevaClave } from '/seguimiento/seguimiento.js';

const selector = document.getElementById('repartidor');
const recargar = document.getElementById('recargar');
const resumen = document.getElementById('resumen');
const mensaje = document.getElementById('mensaje');
const contenedorTareas = document.getElementById('tareas');
const contenedorTemporal = document.getElementById('temporal');
const botonesConexion = [...document.querySelectorAll('#conexion [data-estado]')];
const botonSimular = document.getElementById('simular');
const botonNoVigente = document.getElementById('no-vigente');

const TEXTO_ACCION = {
  RETIRADO: 'Registrar retiro',
  EN_TRANSITO: 'Marcar en tránsito',
  INCIDENCIA: 'Reportar incidencia',
  CANCELADO: 'Cancelar envío',
  ENTREGADO: 'Registrar entrega',
};
const CLASE_ACCION = {
  RETIRADO: 'boton',
  EN_TRANSITO: 'boton',
  INCIDENCIA: 'boton boton--secundario',
  CANCELADO: 'boton boton--peligro',
  ENTREGADO: 'boton boton--exito',
};
const RECEPTORES = [
  ['DESTINATARIO', 'Destinatario'],
  ['FAMILIAR', 'Familiar'],
  ['VECINO', 'Vecino'],
  ['PORTERIA', 'Portería / conserje'],
  ['OTRO', 'Otra persona'],
];

let repartidor = '';
let posicion = { x: 50, y: 50 };
let temporizadorTemporal = null;
// Una clave por envío mientras el formulario de entrega está abierto: los reintentos la reutilizan.
const clavesEvidencia = new Map();

function avisar(tipo, texto, detalles) {
  mostrarMensaje(mensaje, tipo, texto, detalles);
  mensaje.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Paseo aleatorio por el plano ficticio 0–100 (nunca coordenadas reales). */
function moverPosicion() {
  const paso = () => Math.round((Math.random() * 16 - 8) * 10) / 10;
  posicion = {
    x: Math.min(100, Math.max(0, Math.round((posicion.x + paso()) * 10) / 10)),
    y: Math.min(100, Math.max(0, Math.round((posicion.y + paso()) * 10) / 10)),
  };
  return posicion;
}

function campo(etiqueta, control, ayuda) {
  const caja = el('div', 'campo');
  const label = el('label', '', etiqueta);
  label.htmlFor = control.id;
  caja.append(label, control);
  if (ayuda) caja.append(el('span', 'ayuda', ayuda));
  return caja;
}

function entrada(id, { valor = '', max = 80, placeholder = '' } = {}) {
  const input = el('input');
  input.id = id;
  input.value = valor;
  input.maxLength = max;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  return input;
}

// ---------- Cambios de estado ----------

async function enviarCambio(tarea, estado, extra, boton) {
  boton.disabled = true;
  try {
    const pos = moverPosicion();
    const r = await api(`/api/seguimiento/${tarea.codigo}/eventos`, {
      metodo: 'POST',
      cuerpo: { repartidor, estado, ubicacion_x: pos.x, ubicacion_y: pos.y, ...extra },
    });
    avisar('exito', r.cambiado
      ? `${tarea.codigo}: ${r.estado_anterior} → ${r.estado}. Evento #${r.evento.secuencia} registrado por ${r.actor}.`
      : `${tarea.codigo} ya estaba en ${r.estado}; no se registró un evento nuevo.`);
    await Promise.all([cargarTareas(), cargarTemporal()]);
  } catch (error) {
    avisar('error', error.message, error.detalles);
    boton.disabled = false;
  }
}

function formularioMotivo(tarea, estado, boton) {
  const form = el('form', 'tarea__form');
  form.noValidate = true;
  const motivo = el('textarea');
  motivo.id = `motivo-${tarea.codigo}-${estado}`;
  motivo.maxLength = 200;
  motivo.placeholder = estado === 'INCIDENCIA' ? 'Ej.: Calle cerrada por obras' : 'Ej.: Destinatario no ubicado tras la incidencia';
  motivo.style.minHeight = '60px';
  const enviar = el('button', CLASE_ACCION[estado], estado === 'INCIDENCIA' ? 'Registrar incidencia' : 'Confirmar cancelación');
  enviar.type = 'submit';
  form.append(campo('Motivo (obligatorio)', motivo), enviar);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    enviarCambio(tarea, estado, { motivo: motivo.value }, enviar);
  });
  boton.after(form);
  motivo.focus();
}

// ---------- Entrega con evidencia ----------

function formularioEntrega(tarea, tarjeta) {
  const clave = clavesEvidencia.get(tarea.codigo) || nuevaClave();
  clavesEvidencia.set(tarea.codigo, clave);
  const id = (n) => `${n}-${tarea.codigo}`;

  const form = el('form', 'tarea__form');
  form.noValidate = true;
  form.append(el('strong', '', 'Evidencia de entrega'));

  const tipo = el('select');
  tipo.id = id('receptor-tipo');
  for (const [valor, texto] of RECEPTORES) {
    const opcion = el('option', '', texto);
    opcion.value = valor;
    tipo.append(opcion);
  }
  const nombre = entrada(id('receptor-nombre'), { valor: tarea.destinatario, placeholder: 'Nombre ficticio' });
  const relacion = entrada(id('receptor-relacion'), { max: 60, placeholder: 'Ej.: hermana, conserje' });
  const documento = entrada(id('receptor-documento'), { max: 20, placeholder: 'Ej.: DOC-0001 (ficticio)' });
  const cajaRelacion = campo('Relación con el destinatario', relacion);
  cajaRelacion.hidden = true;
  tipo.addEventListener('change', () => { cajaRelacion.hidden = tipo.value === 'DESTINATARIO'; });

  const observacion = el('textarea');
  observacion.id = id('observacion');
  observacion.maxLength = 300;
  observacion.placeholder = 'Ej.: Entregado en mano, paquete en buen estado';
  observacion.style.minHeight = '60px';

  const foto = entrada(id('foto'), { valor: `SIM-FOTO-${tarea.codigo}-${Date.now().toString(36).toUpperCase()}`, max: 300 });

  const rejilla = el('div', 'rejilla');
  rejilla.append(campo('Quién recibe', tipo), campo('Nombre de quien recibe', nombre), cajaRelacion,
    campo('Documento (opcional)', documento));
  const enviar = el('button', CLASE_ACCION.ENTREGADO, 'Confirmar entrega');
  enviar.type = 'submit';
  form.append(
    rejilla,
    campo('Observación (opcional)', observacion),
    campo('Foto simulada', foto, 'Referencia o URL inventada; no se sube ninguna imagen real.'),
    el('div', 'clave-evidencia', `Clave de evidencia: ${clave} (se reutiliza si reintentas)`),
    enviar,
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    enviar.disabled = true;
    const pos = moverPosicion();
    const cuerpo = {
      clave_evidencia: clave,
      codigo_envio: tarea.codigo,
      repartidor,
      receptor_tipo: tipo.value,
      receptor_nombre: nombre.value,
      foto_referencia: foto.value,
      observacion: observacion.value,
      ubicacion_x: pos.x,
      ubicacion_y: pos.y,
    };
    if (tipo.value !== 'DESTINATARIO') cuerpo.receptor_relacion = relacion.value;
    if (documento.value.trim()) cuerpo.receptor_documento = documento.value;
    try {
      const r = await api('/api/evidencias', { metodo: 'POST', cuerpo });
      clavesEvidencia.delete(tarea.codigo);
      avisar('exito', r.creada
        ? `${tarea.codigo} entregado. Evidencia guardada en MongoDB y entrega confirmada en PostgreSQL.`
        : `${tarea.codigo} ya estaba entregado con esta misma evidencia (reintento sin duplicar).`);
      await Promise.all([cargarTareas(), cargarTemporal()]);
    } catch (error) {
      // 503: la clave se conserva y el reintento es seguro.
      const extra = error.status === 503 ? ' Puedes reintentar: se usará la misma clave de evidencia.' : '';
      avisar('error', error.message + extra, error.detalles);
      enviar.disabled = false;
    }
  });
  tarjeta.append(form);
  nombre.focus();
}

// ---------- Tareas ----------

function pintarTarea(tarea) {
  const tarjeta = el('article', 'tarea');
  const cabecera = el('div', 'tarea__cabecera');
  const codigo = el('a', 'tarea__codigo', tarea.codigo);
  codigo.href = `/seguimiento/detalle.html?codigo=${encodeURIComponent(tarea.codigo)}`;
  cabecera.append(codigo, etiquetaEstado(tarea.estado));

  const ruta = el('div', 'tarea__ruta');
  const bloque = (titulo, texto, sub) => {
    const d = el('div');
    d.append(el('span', '', titulo), document.createTextNode(texto));
    if (sub) d.append(el('div', 'tenue', sub));
    return d;
  };
  ruta.append(
    bloque('Retiro', tarea.origen.direccion, tarea.origen.zona),
    bloque('Entrega', tarea.destino.direccion, `${tarea.destino.zona} · ${tarea.destinatario}`),
    bloque('Paquete', tarea.paquete.descripcion, `${tarea.paquete.peso_kg} kg · ${tarea.servicio}`),
    bloque('Asignado', formatearFecha(tarea.asignada_en)),
  );
  tarjeta.append(cabecera, ruta);

  const acciones = el('div', 'tarea__acciones');
  for (const estado of tarea.acciones) {
    const boton = el('button', `${CLASE_ACCION[estado]} boton--pequeno`, TEXTO_ACCION[estado]);
    boton.type = 'button';
    boton.addEventListener('click', () => {
      tarjeta.querySelectorAll('.tarea__form').forEach((f) => f.remove());
      if (estado === 'ENTREGADO') formularioEntrega(tarea, tarjeta);
      else if (estado === 'INCIDENCIA' || estado === 'CANCELADO') formularioMotivo(tarea, estado, acciones);
      else enviarCambio(tarea, estado, {}, boton);
    });
    acciones.append(boton);
  }
  tarjeta.append(acciones);
  return tarjeta;
}

async function cargarTareas() {
  if (!repartidor) return;
  try {
    const datos = await api(`/api/seguimiento/repartidores/${repartidor}/tareas`);
    const r = datos.repartidor;
    resumen.replaceChildren();
    const item = (nombre, valor) => {
      const s = el('span', '', `${nombre}: `);
      s.append(el('strong', '', valor));
      return s;
    };
    resumen.append(item('Zona', r.zona.nombre), item('Carga', `${r.carga_actual} de ${r.capacidad_maxima}`),
      item('Activo', r.activo ? 'sí' : 'no'));
    if (!datos.tareas.length) {
      contenedorTareas.replaceChildren(el('p', 'estado-vacio', 'Este repartidor no tiene envíos en curso. Asígnale uno desde el panel de despacho.'));
      return;
    }
    contenedorTareas.replaceChildren(...datos.tareas.map(pintarTarea));
  } catch (error) {
    contenedorTareas.replaceChildren(el('p', 'tenue', error.message));
  }
}

// ---------- Estado temporal (Redis) ----------

async function cargarTemporal() {
  clearTimeout(temporizadorTemporal);
  if (!repartidor) return;
  try {
    const datos = await api(`/api/estado-temporal/repartidores/${repartidor}`);
    if (datos.ubicacion.vigente) posicion = { x: datos.ubicacion.x, y: datos.ubicacion.y };
    contenedorTemporal.replaceChildren(bloqueTemporal(datos));
    for (const b of botonesConexion) {
      b.disabled = false;
      b.setAttribute('aria-pressed', String(datos.conexion.vigente && datos.conexion.estado === b.dataset.estado));
    }
    botonSimular.disabled = false;
    botonNoVigente.disabled = false;
  } catch (error) {
    const caja = el('div', 'seg-aviso seg-aviso--error', error.message);
    contenedorTemporal.replaceChildren(caja);
    [...botonesConexion, botonSimular, botonNoVigente].forEach((b) => { b.disabled = true; });
  }
  // Se refresca cada 5 s para ver cómo baja el TTL y cuándo expira.
  temporizadorTemporal = setTimeout(cargarTemporal, 5000);
}

async function accionTemporal(ruta, metodo, cuerpo, boton) {
  boton.disabled = true;
  try {
    await api(`/api/estado-temporal/repartidores/${repartidor}${ruta}`, { metodo, cuerpo });
  } catch (error) {
    avisar('error', error.message, error.detalles);
  }
  await cargarTemporal();
}

botonSimular.addEventListener('click', () => {
  const pos = moverPosicion();
  accionTemporal('/ubicacion', 'PUT', { x: pos.x, y: pos.y }, botonSimular);
});
botonNoVigente.addEventListener('click', () => accionTemporal('/no-vigente', 'PATCH', undefined, botonNoVigente));
for (const b of botonesConexion) {
  b.addEventListener('click', () => accionTemporal('/conexion', 'PUT', { estado: b.dataset.estado }, b));
}

// ---------- Selección del repartidor ----------

function seleccionar(codigo) {
  repartidor = codigo;
  mensaje.className = 'oculto';
  clavesEvidencia.clear();
  posicion = { x: 20 + Math.round(Math.random() * 60), y: 20 + Math.round(Math.random() * 60) };
  history.replaceState(null, '', codigo ? `?rep=${encodeURIComponent(codigo)}` : location.pathname);
  if (!codigo) {
    contenedorTareas.replaceChildren(el('p', 'tenue', 'Elige un repartidor.'));
    contenedorTemporal.replaceChildren(el('p', 'tenue', 'Elige un repartidor.'));
    resumen.replaceChildren();
    clearTimeout(temporizadorTemporal);
    return;
  }
  contenedorTareas.replaceChildren(el('p', 'tenue', 'Cargando tareas…'));
  cargarTareas();
  cargarTemporal();
}

async function cargarRepartidores() {
  try {
    const lista = await api('/api/despacho/repartidores');
    selector.replaceChildren();
    const vacia = el('option', '', 'Elige un repartidor');
    vacia.value = '';
    selector.append(vacia);
    for (const r of lista.filter((x) => x.activo)) {
      const opcion = el('option', '', `${r.codigo} · ${r.nombre} · ${r.zona} (${r.carga_actual}/${r.capacidad_maxima})`);
      opcion.value = r.codigo;
      selector.append(opcion);
    }
    const pedido = new URLSearchParams(location.search).get('rep');
    if (pedido && lista.some((r) => r.codigo === pedido)) {
      selector.value = pedido;
      seleccionar(pedido);
    }
  } catch (error) {
    avisar('error', error.message);
  }
}

selector.addEventListener('change', () => seleccionar(selector.value));
recargar.addEventListener('click', () => { cargarTareas(); cargarTemporal(); });
cargarRepartidores();
