// Comprobante de la solicitud recién registrada (Dominio 1 · Liliana Averos).
// Lee el envío desde GET /api/envios/:codigo; no confía en datos guardados en el navegador.
import { api, mostrarMensaje } from '/js/api.js';
import {
  pintarComprobante, botonCopiar, botonImprimir, boton, ICONOS, esCodigoValido, normalizarCodigo,
} from '/envios/envios.js';

const contenedor = document.getElementById('comprobante');
const mensaje = document.getElementById('mensaje');
const titulo = document.getElementById('titulo');
const subtitulo = document.getElementById('subtitulo');

function enlaceBoton(texto, href, icono, clase = 'boton') {
  const b = boton(texto, { clase, icono });
  b.addEventListener('click', () => window.location.assign(href));
  return b;
}

function sinComprobante(texto) {
  titulo.textContent = 'No hay comprobante para mostrar';
  subtitulo.textContent = 'Registra una solicitud o búscala por su código.';
  mostrarMensaje(mensaje, 'error', texto);
  contenedor.replaceChildren();
  const acciones = document.createElement('div');
  acciones.className = 'grupo-botones';
  acciones.append(
    enlaceBoton('Solicitar un envío', '/envios/solicitud.html', ICONOS.nuevo),
    enlaceBoton('Buscar por código', '/envios/consulta.html', ICONOS.buscar, 'boton boton--secundario'),
  );
  contenedor.append(acciones);
}

async function iniciar() {
  const codigo = normalizarCodigo(new URLSearchParams(window.location.search).get('codigo'));
  if (!esCodigoValido(codigo)) {
    sinComprobante('El enlace no trae un código de envío válido.');
    return;
  }
  try {
    const envio = await api(`/api/envios/${encodeURIComponent(codigo)}`);
    document.title = `${envio.codigo} · Confirmación · Mensajería Urbana`;
    if (envio.estado !== 'CREADO') {
      titulo.textContent = 'Comprobante de la solicitud';
      subtitulo.textContent = 'Esta solicitud ya avanzó desde su registro. Se muestra su estado vigente.';
    }
    pintarComprobante(contenedor, envio, [
      botonCopiar(envio.codigo),
      botonImprimir(),
      enlaceBoton('Gestionar', `/envios/consulta.html?codigo=${encodeURIComponent(envio.codigo)}`, ICONOS.buscar,
        'boton boton--secundario'),
      enlaceBoton('Nueva solicitud', '/envios/solicitud.html', ICONOS.nuevo),
    ]);
  } catch (error) {
    sinComprobante(error.message);
  }
}

iniciar();
