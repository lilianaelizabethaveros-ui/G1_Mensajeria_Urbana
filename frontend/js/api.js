// Cliente de la API compartido por todas las pantallas.
// El navegador solo habla con la API; nunca con las bases de datos.

export class ErrorApi extends Error {
  constructor(status, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

/**
 * Llama a la API y devuelve `datos` si la respuesta es { ok: true, datos }.
 * Si la API responde con error, lanza ErrorApi con el mensaje comprensible.
 * Ejemplo: const envio = await api('/api/envios', { metodo: 'POST', cuerpo: {...} });
 */
export async function api(ruta, { metodo = 'GET', cuerpo, encabezados = {} } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, {
      method: metodo,
      headers: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...encabezados },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No se pudo contactar con el servidor. Revisa que la API esté en ejecución.');
  }

  let json = null;
  try {
    json = await respuesta.json();
  } catch {
    // La respuesta no era JSON
  }

  if (!respuesta.ok || !json || json.ok === false) {
    const error = json?.error;
    throw new ErrorApi(
      respuesta.status,
      error?.codigo || 'ERROR_DESCONOCIDO',
      error?.mensaje || `El servidor respondió con el código ${respuesta.status}.`,
      error?.detalles || [],
    );
  }
  return json.datos;
}

/** Muestra un mensaje de éxito o error dentro de un elemento. Usa textContent (no HTML). */
export function mostrarMensaje(elemento, tipo, texto, detalles = []) {
  elemento.replaceChildren();
  elemento.className = `mensaje ${tipo}`;
  const parrafo = document.createElement('p');
  parrafo.textContent = texto;
  parrafo.style.margin = '0';
  elemento.append(parrafo);
  if (detalles.length) {
    const lista = document.createElement('ul');
    for (const d of detalles) {
      const item = document.createElement('li');
      item.textContent = d.mensaje || String(d);
      lista.append(item);
    }
    elemento.append(lista);
  }
}
