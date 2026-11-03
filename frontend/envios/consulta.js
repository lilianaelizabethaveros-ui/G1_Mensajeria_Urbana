// Gestión de una solicitud por código (Dominio 1 · Liliana Averos).
// Muestra el comprobante y permite las dos operaciones de este dominio:
//   PATCH /api/envios/:codigo/aceptar   CREADO → ACEPTADO (operador)
//   PATCH /api/envios/:codigo/cancelar  CREADO | ACEPTADO → CANCELADO (con motivo)
// La API decide si la operación es válida; los botones solo reflejan el estado vigente.
import { api, mostrarMensaje } from '/js/api.js';
import {
  pintarComprobante, botonCopiar, botonImprimir, esCodigoValido, normalizarCodigo, el,
} from '/envios/envios.js';

const buscar = document.getElementById('buscar');
const entrada = document.getElementById('codigo');
const mensaje = document.getElementById('mensaje');
const resultado = document.getElementById('resultado');
const operaciones = document.getElementById('operaciones');
const botonAceptar = document.getElementById('boton-aceptar');
const formCancelar = document.getElementById('accion-cancelar');
const botonCancelar = document.getElementById('boton-cancelar');
const motivo = document.getElementById('motivo');
const notaAceptar = document.getElementById('nota-aceptar');
const notaCancelar = document.getElementById('nota-cancelar');
const errorMotivo = formCancelar.querySelector('[data-error="motivo"]');

let actual = null;

const ACEPTABLE = ['CREADO'];
const CANCELABLE = ['CREADO', 'ACEPTADO'];

function ocultarMensaje() {
  mensaje.className = 'oculto';
  mensaje.replaceChildren();
}

function mostrar(tipo, texto, detalles) {
  mostrarMensaje(mensaje, tipo, texto, detalles);
}

function razon(estado, permitidos, verbo) {
  if (permitidos.includes(estado)) return '';
  if (estado === 'CANCELADO') return `No se puede ${verbo}: la solicitud ya está cancelada.`;
  if (estado === 'ENTREGADO') return `No se puede ${verbo}: el envío ya fue entregado.`;
  if (verbo === 'aceptar' && estado === 'ACEPTADO') return 'Esta solicitud ya fue aceptada.';
  return `No se puede ${verbo} en estado ${estado}: el envío ya está en manos de despacho o seguimiento.`;
}

function pintar(envio) {
  actual = envio;
  pintarComprobante(resultado, envio, [botonCopiar(envio.codigo), botonImprimir()]);
  operaciones.classList.remove('oculto');

  const motivoAceptar = razon(envio.estado, ACEPTABLE, 'aceptar');
  botonAceptar.disabled = Boolean(motivoAceptar);
  notaAceptar.textContent = motivoAceptar;

  const motivoCancelar = razon(envio.estado, CANCELABLE, 'cancelar');
  botonCancelar.disabled = Boolean(motivoCancelar);
  motivo.disabled = Boolean(motivoCancelar);
  formCancelar.querySelector('#actor').disabled = Boolean(motivoCancelar);
  notaCancelar.textContent = motivoCancelar;
}

async function consultar(codigo, { silencioso = false } = {}) {
  if (!silencioso) ocultarMensaje();
  resultado.replaceChildren(el('div', 'panel estado-vacio', 'Buscando…'));
  operaciones.classList.add('oculto');
  try {
    const envio = await api(`/api/envios/${encodeURIComponent(codigo)}`);
    pintar(envio);
    const url = new URL(window.location.href);
    url.searchParams.set('codigo', envio.codigo);
    window.history.replaceState(null, '', url);
  } catch (error) {
    actual = null;
    resultado.replaceChildren();
    mostrar('error', error.status === 404
      ? `No encontramos ninguna solicitud con el código ${codigo}. Revisa que esté bien escrito.`
      : error.message);
  }
}

buscar.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const codigo = normalizarCodigo(entrada.value);
  entrada.value = codigo;
  if (!esCodigoValido(codigo)) {
    ocultarMensaje();
    mostrar('error', 'El código debe tener el formato ENV- seguido de 8 caracteres (por ejemplo, ENV-7K2M9XQ4).');
    entrada.focus();
    return;
  }
  consultar(codigo);
});

async function operar(boton, ruta, cuerpo, textoExito, textoSinCambio) {
  if (!actual) return;
  ocultarMensaje();
  boton.disabled = true;
  try {
    const respuesta = await fetch(`/api/envios/${encodeURIComponent(actual.codigo)}/${ruta}`, {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
    });
    const json = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !json?.ok) {
      const e = json?.error;
      mostrar('error', e?.mensaje || `El servidor respondió con el código ${respuesta.status}.`, e?.detalles || []);
      return { error: e };
    }
    pintar(json.datos);
    mostrar('exito', json.cambiado ? textoExito : textoSinCambio);
    return { ok: true };
  } catch {
    mostrar('error', 'No se pudo contactar con la API. Revisa que los contenedores estén en ejecución.');
    return { error: true };
  } finally {
    if (actual) pintar(actual); // vuelve a habilitar según el estado vigente
  }
}

botonAceptar.addEventListener('click', () => {
  operar(botonAceptar, 'aceptar', {},
    'Solicitud aceptada. Ya está disponible para el panel de despacho.',
    'La solicitud ya estaba aceptada; no se registró un cambio nuevo.');
});

formCancelar.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = motivo.value.trim();
  errorMotivo.textContent = '';
  motivo.closest('.campo').classList.remove('invalido');
  if (texto.length < 5) {
    errorMotivo.textContent = 'Escribe un motivo de al menos 5 caracteres.';
    motivo.closest('.campo').classList.add('invalido');
    motivo.focus();
    return;
  }
  const confirmado = window.confirm(`¿Cancelar la solicitud ${actual?.codigo}? Esta acción no se puede deshacer.`);
  if (!confirmado) return;
  const r = await operar(botonCancelar, 'cancelar', { motivo: texto, actor: formCancelar.actor.value },
    'Solicitud cancelada. El motivo quedó registrado en el historial.',
    'La solicitud ya estaba cancelada; no se registró un cambio nuevo.');
  if (r?.ok) motivo.value = '';
});

const inicial = normalizarCodigo(new URLSearchParams(window.location.search).get('codigo'));
if (inicial) {
  entrada.value = inicial;
  if (esCodigoValido(inicial)) consultar(inicial);
  else mostrar('error', 'El enlace no trae un código de envío válido.');
}
