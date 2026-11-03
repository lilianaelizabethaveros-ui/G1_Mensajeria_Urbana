// Formulario de solicitud de envío (Dominio 1 · Liliana Averos).
// - Los catálogos (zonas y tipos de servicio) vienen de GET /api/catalogos.
// - La API valida todo de nuevo; aquí solo se ayuda a la persona usuaria.
// - Cada formulario tiene una clave de idempotencia: si el envío se reintenta
//   (doble clic, red lenta), la API devuelve el mismo envío en lugar de duplicarlo.
import { api, mostrarMensaje } from '/js/api.js';
import { el, nuevaClave } from '/envios/envios.js';

const formulario = document.getElementById('formulario');
const mensaje = document.getElementById('mensaje');
const botonEnviar = document.getElementById('enviar');
const contenedorServicios = document.getElementById('servicios');
const peso = document.getElementById('peso_kg');
const ayudaPeso = document.getElementById('ayuda-peso');
const estimado = document.getElementById('estimado');
const observaciones = document.getElementById('observaciones');
const contador = document.getElementById('contador');

const TELEFONO = /^0\d{8,9}$/;
let tipos = [];
let clave = nuevaClave();
let enviando = false;

// ---------- Catálogos ----------
function llenarZonas(zonas) {
  for (const select of document.querySelectorAll('[data-zonas]')) {
    const vacia = el('option', '', 'Selecciona una zona');
    vacia.value = '';
    const opciones = zonas.map((z) => {
      const o = el('option', '', z.nombre);
      o.value = z.codigo;
      return o;
    });
    select.replaceChildren(vacia, ...opciones);
  }
}

function llenarServicios(lista) {
  tipos = lista;
  const tarjetas = lista.map((t, i) => {
    const etiqueta = el('label', 'servicio');
    const radio = el('input');
    radio.type = 'radio';
    radio.name = 'tipo_servicio';
    radio.value = t.codigo;
    radio.required = true;
    if (i === 0) radio.id = 'tipo_servicio';
    const caja = el('span', 'servicio__caja');
    caja.append(
      el('span', 'servicio__nombre', t.nombre),
      el('span', 'servicio__detalle', `Hasta ${t.tiempo_estimado_horas} h · máx. ${t.peso_maximo_kg} kg`),
    );
    if (t.descripcion) caja.append(el('span', 'servicio__detalle', t.descripcion));
    etiqueta.append(radio, caja);
    return etiqueta;
  });
  contenedorServicios.replaceChildren(...tarjetas);
}

async function cargarCatalogos() {
  try {
    const { zonas, tipos_servicio: tiposServicio } = await api('/api/catalogos');
    llenarZonas(zonas);
    llenarServicios(tiposServicio);
  } catch (error) {
    mostrarError(`No se pudieron cargar los catálogos: ${error.message}`);
    botonEnviar.disabled = true;
  }
}

// ---------- Ayudas en vivo ----------
function tipoElegido() {
  const radio = formulario.querySelector('input[name="tipo_servicio"]:checked');
  return radio ? tipos.find((t) => t.codigo === radio.value) : null;
}

function actualizarAyudas() {
  const tipo = tipoElegido();
  if (tipo) {
    peso.max = String(tipo.peso_maximo_kg);
    ayudaPeso.textContent = `Máximo ${tipo.peso_maximo_kg} kg para ${tipo.nombre}.`;
    const fecha = new Date(Date.now() + tipo.tiempo_estimado_horas * 3600 * 1000);
    estimado.value = fecha.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
  }
  contador.textContent = String(observaciones.value.length);
}

formulario.addEventListener('change', actualizarAyudas);
observaciones.addEventListener('input', actualizarAyudas);
// Al corregir un campo se quita su marca de error.
formulario.addEventListener('input', (evento) => {
  const nombre = evento.target.name;
  if (nombre) marcarCampo(nombre, '');
});

// ---------- Errores por campo ----------
function marcarCampo(nombre, texto) {
  const span = formulario.querySelector(`[data-error="${nombre}"]`);
  if (!span) return false;
  span.textContent = texto;
  span.closest('.campo')?.classList.toggle('invalido', Boolean(texto));
  return true;
}

function limpiarErrores() {
  for (const span of formulario.querySelectorAll('[data-error]')) marcarCampo(span.dataset.error, '');
  mensaje.className = 'oculto';
  mensaje.replaceChildren();
}

function mostrarError(texto, detalles = []) {
  mostrarMensaje(mensaje, 'error', texto, detalles);
  mensaje.focus();
}

function enfocarPrimerError() {
  const primero = formulario.querySelector('.campo.invalido input, .campo.invalido select, .campo.invalido textarea');
  primero?.focus();
}

// Comprobación rápida en el navegador (la definitiva la hace la API).
function revisarEnNavegador(datos) {
  const errores = [];
  const requeridos = {
    remitente_nombre: 'Escribe el nombre de quien envía.',
    remitente_telefono: 'Escribe un teléfono.',
    origen_direccion: 'Escribe la dirección de retiro.',
    origen_zona: 'Elige la zona de retiro.',
    destinatario_nombre: 'Escribe el nombre de quien recibe.',
    destinatario_telefono: 'Escribe un teléfono.',
    destino_direccion: 'Escribe la dirección de entrega.',
    destino_zona: 'Elige la zona de entrega.',
    tipo_servicio: 'Elige un tipo de servicio.',
    descripcion: 'Describe el contenido del paquete.',
    peso_kg: 'Indica el peso en kg.',
  };
  for (const [campo, texto] of Object.entries(requeridos)) {
    if (datos[campo] === '' || datos[campo] === undefined) errores.push({ campo, mensaje: texto });
  }
  for (const campo of ['remitente_telefono', 'destinatario_telefono']) {
    if (datos[campo] && !TELEFONO.test(datos[campo])) {
      errores.push({ campo, mensaje: '9 o 10 dígitos que empiecen con 0, sin espacios.' });
    }
  }
  const tipo = tipoElegido();
  if (datos.peso_kg !== '' && tipo && Number(datos.peso_kg) > tipo.peso_maximo_kg) {
    errores.push({ campo: 'peso_kg', mensaje: `${tipo.nombre} admite como máximo ${tipo.peso_maximo_kg} kg.` });
  }
  return errores;
}

function pintarErrores(detalles) {
  const sinCampo = [];
  for (const d of detalles) {
    if (!d.campo || !marcarCampo(d.campo, d.mensaje)) sinCampo.push(d);
  }
  return sinCampo;
}

// ---------- Envío ----------
function leerFormulario() {
  const f = new FormData(formulario);
  const texto = (n) => String(f.get(n) ?? '').trim();
  return {
    remitente_nombre: texto('remitente_nombre'),
    remitente_telefono: texto('remitente_telefono'),
    origen_direccion: texto('origen_direccion'),
    origen_zona: texto('origen_zona'),
    destinatario_nombre: texto('destinatario_nombre'),
    destinatario_telefono: texto('destinatario_telefono'),
    destino_direccion: texto('destino_direccion'),
    destino_zona: texto('destino_zona'),
    tipo_servicio: texto('tipo_servicio'),
    descripcion: texto('descripcion'),
    peso_kg: texto('peso_kg'),
    observaciones: texto('observaciones'),
  };
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (enviando) return; // evita el doble envío por doble clic
  limpiarErrores();

  const datos = leerFormulario();
  const locales = revisarEnNavegador(datos);
  if (locales.length) {
    pintarErrores(locales);
    mostrarError('Revisa los campos marcados en rojo.');
    enfocarPrimerError();
    return;
  }

  enviando = true;
  botonEnviar.disabled = true;
  botonEnviar.lastChild.textContent = ' Registrando…';
  try {
    const envio = await api('/api/envios', {
      metodo: 'POST',
      cuerpo: { ...datos, peso_kg: Number(datos.peso_kg) },
      encabezados: { 'Idempotency-Key': clave },
    });
    // Éxito: ir al comprobante. La clave ya quedó usada por este envío.
    window.location.assign(`/envios/confirmacion.html?codigo=${encodeURIComponent(envio.codigo)}`);
    return;
  } catch (error) {
    if (error.status === 400 && error.detalles.length) {
      const sinCampo = pintarErrores(error.detalles);
      mostrarError('La API rechazó algunos datos. Revisa los campos marcados en rojo.', sinCampo);
      enfocarPrimerError();
    } else if (error.status === 0 || error.status >= 500) {
      // Puede que la API sí lo haya guardado: se conserva la clave para reintentar sin duplicar.
      mostrarError(`${error.message} Puedes volver a pulsar "Registrar solicitud": no se creará un duplicado.`);
    } else {
      mostrarError(error.message, error.detalles);
    }
  } finally {
    enviando = false;
    botonEnviar.disabled = false;
    botonEnviar.lastChild.textContent = ' Registrar solicitud';
  }
});

// Si la persona vuelve con el botón Atrás tras registrar, se usa una clave nueva
// para que una segunda solicitud distinta no se confunda con la anterior.
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) clave = nuevaClave();
});

cargarCatalogos();
