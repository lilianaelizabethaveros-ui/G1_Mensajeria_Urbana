// Pantalla de inicio: muestra el estado de GET /health.
// /health responde 503 cuando un gestor está caído pero igual trae el detalle,
// por eso aquí se lee directamente con fetch en lugar de api().
// Todo el contenido se inserta con textContent (nunca como HTML).

const boton = document.getElementById('actualizar');
const resumen = document.getElementById('resumen');
const resumenTexto = document.getElementById('resumen-texto');
const actualizado = document.getElementById('actualizado');
const NOMBRES = { postgres: 'PostgreSQL', mongo: 'MongoDB', redis: 'Redis' };

function pintarGestor(nombre, gestor) {
  const tarjeta = document.querySelector(`.gestor[data-gestor="${nombre}"]`);
  if (!tarjeta) return;
  const estado = tarjeta.querySelector('.gestor__estado');
  const ms = tarjeta.querySelector('.gestor__ms');
  const ok = gestor?.estado === 'ok';

  estado.textContent = ok ? 'En línea' : 'Caído';
  estado.className = `gestor__estado ${ok ? 'ok' : 'error'}`;
  ms.className = `gestor__ms${ok ? '' : ' error'}`;
  if (ok) {
    const unidad = document.createElement('small');
    unidad.textContent = 'ms de respuesta';
    ms.replaceChildren(String(gestor.ms), unidad);
  } else {
    ms.textContent = gestor?.error || 'Sin respuesta';
  }
}

function pintarIndicadores(datos) {
  const pendientes = document.getElementById('outbox-pendientes');
  const outboxDetalle = document.getElementById('outbox-detalle');
  const migraciones = document.getElementById('migraciones-total');
  const migracionesDetalle = document.getElementById('migraciones-detalle');

  if (datos.outbox) {
    const o = datos.outbox;
    pendientes.textContent = String(o.pendientes);
    outboxDetalle.textContent = o.pendientes > 0 && o.antiguedad_segundos !== null
      ? `El más antiguo espera desde hace ${o.antiguedad_segundos} s · ${o.total} eventos en total`
      : `Todo sincronizado · ${o.total} eventos en total`;
  } else {
    pendientes.textContent = '—';
    outboxDetalle.textContent = 'No disponible mientras PostgreSQL no responda';
  }

  if (datos.migraciones) {
    const m = datos.migraciones;
    migraciones.textContent = String(m.aplicadas);
    migracionesDetalle.textContent = m.ultima !== null
      ? `Última versión: ${String(m.ultima).padStart(3, '0')}`
      : 'Ninguna aplicada todavía';
  } else {
    migraciones.textContent = '—';
    migracionesDetalle.textContent = 'No disponible mientras PostgreSQL no responda';
  }
}

function pintarResumen(clase, texto) {
  resumen.className = `resumen${clase ? ` resumen--${clase}` : ''}`;
  resumenTexto.textContent = texto;
}

async function actualizar() {
  boton.disabled = true;
  boton.classList.add('girando');
  try {
    const respuesta = await fetch('/health', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const { datos } = await respuesta.json();

    for (const nombre of Object.keys(NOMBRES)) pintarGestor(nombre, datos.gestores[nombre]);
    pintarIndicadores(datos);

    const caidos = Object.entries(datos.gestores)
      .filter(([, g]) => g.estado !== 'ok')
      .map(([nombre]) => NOMBRES[nombre] || nombre);
    if (caidos.length === 0) {
      pintarResumen('ok', 'Todos los servicios están operativos');
    } else {
      pintarResumen('error', `Servicio no disponible: ${caidos.join(', ')}. La API sigue atendiendo.`);
    }
    actualizado.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-EC')}`;
  } catch {
    pintarResumen('error', 'No se pudo contactar con la API. Revisa que los contenedores estén en ejecución.');
  } finally {
    boton.disabled = false;
    boton.classList.remove('girando');
  }
}

boton.addEventListener('click', actualizar);
actualizar();
// Refresco automático cada 15 s mientras la pestaña está visible.
setInterval(() => { if (!document.hidden) actualizar(); }, 15000);
