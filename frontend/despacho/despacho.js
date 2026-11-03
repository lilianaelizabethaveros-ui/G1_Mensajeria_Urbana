
import { api, mostrarMensaje } from '/js/api.js';

const pendientes = document.getElementById('pendientes');
const repartidores = document.getElementById('repartidores');
const selector = document.getElementById('codigo_repartidor');
const formulario = document.getElementById('formulario-asignacion');
const mensaje = document.getElementById('mensaje');
// Formularios para liberar y reasignar envíos.
const formularioLiberacion = document.getElementById('formulario-liberacion');
const formularioReasignacion = document.getElementById('formulario-reasignacion');
const selectorNuevoRepartidor = document.getElementById('nuevo_repartidor');


// Guardar los envíos obtenidos desde la API.
let enviosPendientes = [];

// Mostrar los envíos según los filtros seleccionados.
function mostrarPendientes() {
  const codigo = document.getElementById('filtro_codigo').value.trim().toUpperCase();
  const zona = document.getElementById('filtro_zona').value;

  const filtrados = enviosPendientes.filter(envio =>
    envio.codigo.includes(codigo) &&
    (zona === '' || envio.zona_destino === zona)
  );

  pendientes.replaceChildren();

  if (filtrados.length === 0) {
    const texto = document.createElement('p');
    texto.textContent = 'No hay envíos pendientes con esos filtros.';
    pendientes.append(texto);
    return;
  }

  for (const envio of filtrados) {
    const elemento = document.createElement('p');
    elemento.textContent =
      `${envio.codigo} | ${envio.destinatario_nombre} | Zona: ${envio.zona_destino}`;
    pendientes.append(elemento);
  }
}

// Consultar los envíos pendientes desde PostgreSQL mediante la API.
async function cargarPendientes() {
  enviosPendientes = await api('/api/despacho/pendientes');
  mostrarPendientes();
}

// Actualizar el listado cuando cambien los filtros.
document.getElementById('filtro_codigo').addEventListener('input', mostrarPendientes);
document.getElementById('filtro_zona').addEventListener('change', mostrarPendientes);


 // Mostrar repartidores, su carga y los cupos disponibles.
async function cargarRepartidores() {
  const lista = await api('/api/despacho/repartidores');

  repartidores.replaceChildren();
  selector.replaceChildren();
  selectorNuevoRepartidor.replaceChildren();

  // Opción inicial para ambos formularios.
  const opcionInicial = document.createElement('option');
  opcionInicial.value = '';
  opcionInicial.textContent = 'Selecciona un repartidor';

  selector.append(opcionInicial);
  selectorNuevoRepartidor.append(opcionInicial.cloneNode(true));

  // Crear una fila por cada repartidor.
  for (const repartidor of lista) {
    const fila = document.createElement('tr');

    const valores = [
      repartidor.codigo,
      repartidor.nombre,
      repartidor.zona,
      `${repartidor.carga_actual}/${repartidor.capacidad_maxima}`,
      repartidor.cupos_disponibles
    ];

    for (const valor of valores) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }

    repartidores.append(fila);

    // Mantener los selectores de asignación y reasignación.
    if (repartidor.activo) {
      const opcion = document.createElement('option');
      opcion.value = repartidor.codigo;
      opcion.textContent =
        `${repartidor.codigo} - ${repartidor.nombre} (${repartidor.zona})`;

      selector.append(opcion);
      selectorNuevoRepartidor.append(opcion.cloneNode(true));
    }
  }
}


// Asignar un repartidor al envío seleccionado.
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const codigoEnvio = document.getElementById('codigo_envio').value.trim();
  const codigoRepartidor = selector.value;

  try {
    const resultado = await api('/api/despacho/asignaciones', {
      metodo: 'POST',
      cuerpo: {
        codigo_envio: codigoEnvio,
        codigo_repartidor: codigoRepartidor
      }
    });

    mostrarMensaje(
      mensaje,
      'mensaje--exito',
      `Envío ${resultado.codigo_envio} asignado a ${resultado.repartidor.nombre}.`
    );

    formulario.reset();
    await cargarPendientes();
    await cargarRepartidores();

  } catch (error) {
    mostrarMensaje(
      mensaje,
      'mensaje--error',
      error.message,
      error.detalles || []
    );
  }
});

// Liberar la asignación de un envío.
formularioLiberacion.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const codigoEnvio = document.getElementById('codigo_liberar').value.trim();

  try {
    const resultado = await api(
      `/api/despacho/asignaciones/${encodeURIComponent(codigoEnvio)}/liberar`,
      { metodo: 'PATCH' }
    );

    mostrarMensaje(
      mensaje,
      'mensaje--exito',
      `Envío ${resultado.codigo_envio} liberado correctamente. Estado: ${resultado.estado}.`
    );

    formularioLiberacion.reset();
    await cargarPendientes();
    await cargarRepartidores();

  } catch (error) {
    mostrarMensaje(
      mensaje,
      'mensaje--error',
      error.message,
      error.detalles || []
    );
  }
});


 // Reasignar un envío a otro repartidor.
formularioReasignacion.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const codigoEnvio = document.getElementById('codigo_reasignar').value.trim();
  const codigoRepartidor = selectorNuevoRepartidor.value;

  try {
    const resultado = await api(
      `/api/despacho/asignaciones/${encodeURIComponent(codigoEnvio)}/reasignar`,
      {
        metodo: 'PATCH',
        cuerpo: {
          codigo_repartidor: codigoRepartidor
        }
      }
    );

    mostrarMensaje(
      mensaje,
      'mensaje--exito',
      `Envío ${resultado.codigo_envio} reasignado de ${resultado.repartidor_anterior} a ${resultado.repartidor_nuevo}.`
    );

    formularioReasignacion.reset();
    await cargarPendientes();
    await cargarRepartidores();

  } catch (error) {
    mostrarMensaje(
      mensaje,
      'mensaje--error',
      error.message,
      error.detalles || []
    );
  }
});


// Cargar los datos al abrir la pantalla.
async function iniciar() {
  try {
    await cargarPendientes();
    await cargarRepartidores();
  } catch (error) {
    mostrarMensaje(
      mensaje,
      'mensaje--error',
      error.message
    );
  }
}

iniciar();
