import { api, mostrarMensaje } from '/js/api.js';

const mensaje = document.getElementById('mensaje');

const tablaZonas = document.getElementById('zonas');
const tablaRepartidores = document.getElementById('repartidores');

let zonas = [];
let repartidores = [];

// Mostrar los resultados de las operaciones.
function notificar(tipo, texto, detalles = []) {
  mostrarMensaje(mensaje, tipo, texto, detalles);
}

// Agregar opciones a un selector.
function llenarSelector(id, datos, texto, seleccion = '') {
  const selector = document.getElementById(id);
  selector.replaceChildren();

  for (const dato of datos) {
    const opcion = document.createElement('option');
    opcion.value = dato.codigo;
    opcion.textContent = texto(dato);
    selector.append(opcion);
  }

  if (seleccion) selector.value = seleccion;
}

// Consultar y mostrar las zonas.
async function cargarZonas() {
  zonas = await api('/api/despacho/admin/zonas');

  tablaZonas.replaceChildren();

  for (const zona of zonas) {
    const fila = document.createElement('tr');

    for (const valor of [
      zona.codigo,
      zona.nombre,
      zona.activa ? 'Activa' : 'Inactiva'
    ]) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }

    tablaZonas.append(fila);
  }

  llenarSelector(
    'editar-zona-codigo',
    zonas,
    zona => `${zona.codigo} - ${zona.nombre}`
  );

  const zonasActivas = zonas.filter(zona => zona.activa);

  llenarSelector(
    'rep-zona',
    zonasActivas,
    zona => zona.codigo
  );

  llenarSelector(
    'editar-rep-zona',
    zonasActivas,
    zona => zona.codigo
  );

  mostrarZonaSeleccionada();
}

// Completar el formulario con los datos de una zona.
function mostrarZonaSeleccionada() {
  const codigo = document.getElementById('editar-zona-codigo').value;
  const zona = zonas.find(item => item.codigo === codigo);

  if (!zona) return;

  document.getElementById('editar-zona-nombre').value = zona.nombre;
  document.getElementById('editar-zona-activa').value = String(zona.activa);
}

// Consultar y mostrar repartidores.
async function cargarRepartidores() {
  repartidores = await api('/api/despacho/repartidores');

  tablaRepartidores.replaceChildren();

  for (const repartidor of repartidores) {
    const fila = document.createElement('tr');

    for (const valor of [
      repartidor.codigo,
      repartidor.nombre,
      repartidor.zona,
      `${repartidor.carga_actual}/${repartidor.capacidad_maxima}`,
      repartidor.cupos_disponibles,
      repartidor.activo ? 'Activo' : 'Inactivo'
    ]) {
      const celda = document.createElement('td');
      celda.textContent = valor;
      fila.append(celda);
    }

    tablaRepartidores.append(fila);
  }

  llenarSelector(
    'editar-rep-codigo',
    repartidores,
    repartidor => `${repartidor.codigo} - ${repartidor.nombre}`
  );

  mostrarRepartidorSeleccionado();
}

// Completar el formulario con los datos del repartidor elegido.
function mostrarRepartidorSeleccionado() {
  const codigo = document.getElementById('editar-rep-codigo').value;
  const repartidor = repartidores.find(item => item.codigo === codigo);

  if (!repartidor) return;

  document.getElementById('editar-rep-nombre').value = repartidor.nombre;
  document.getElementById('editar-rep-zona').value = repartidor.zona;
  document.getElementById('editar-rep-capacidad').value = repartidor.capacidad_maxima;
  document.getElementById('editar-rep-activo').value = String(repartidor.activo);
}

// Ejecutar una operación y mostrar errores de la API.
async function ejecutar(operacion, mensajeExito) {
  try {
    await operacion();
    notificar('mensaje--exito', mensajeExito);
    await cargarZonas();
    await cargarRepartidores();
  } catch (error) {
    notificar(
      'mensaje--error',
      error.message,
      error.detalles || []
    );
  }
}

// Crear zona.
document.getElementById('form-crear-zona').addEventListener('submit', async evento => {
  evento.preventDefault();

  const formulario = evento.currentTarget;

  await ejecutar(async () => {
    await api('/api/despacho/admin/zonas', {
      metodo: 'POST',
      cuerpo: {
        codigo: document.getElementById('zona-codigo').value.trim().toUpperCase(),
        nombre: document.getElementById('zona-nombre').value.trim()
      }
    });

    formulario.reset();
  }, 'Zona creada correctamente.');
});

// Editar repartidor, capacidad o estado.
document.getElementById('form-editar-repartidor').addEventListener('submit', async evento => {
  evento.preventDefault();

  const formulario = evento.currentTarget;
  const codigo = document.getElementById('editar-rep-codigo').value;

  await ejecutar(async () => {
    await api(`/api/despacho/admin/repartidores/${encodeURIComponent(codigo)}`, {
      metodo: 'PATCH',
      cuerpo: {
        nombre: document.getElementById('editar-rep-nombre').value.trim(),
        zona: document.getElementById('editar-rep-zona').value,
        capacidad_maxima: Number(document.getElementById('editar-rep-capacidad').value),
        activo: document.getElementById('editar-rep-activo').value === 'true'
      }
    });

    formulario.reset();
  }, 'Repartidor actualizado correctamente.');
});

// Crear repartidor.
document.getElementById('form-crear-repartidor').addEventListener('submit', async evento => {
  evento.preventDefault();

  const formulario = evento.currentTarget;

  await ejecutar(async () => {
    await api('/api/despacho/admin/repartidores', {
      metodo: 'POST',
      cuerpo: {
        codigo: document.getElementById('rep-codigo').value.trim().toUpperCase(),
        nombre: document.getElementById('rep-nombre').value.trim(),
        zona: document.getElementById('rep-zona').value,
        capacidad_maxima: Number(document.getElementById('rep-capacidad').value)
      }
    });

    formulario.reset();
  }, 'Repartidor creado correctamente.');
});

// Editar repartidor, capacidad o estado.
document.getElementById('form-editar-repartidor').addEventListener('submit', async evento => {
  evento.preventDefault();

  const codigo = document.getElementById('editar-rep-codigo').value;

  await ejecutar(() =>
    api(`/api/despacho/admin/repartidores/${encodeURIComponent(codigo)}`, {
      metodo: 'PATCH',
      cuerpo: {
        nombre: document.getElementById('editar-rep-nombre').value.trim(),
        zona: document.getElementById('editar-rep-zona').value,
        capacidad_maxima: Number(document.getElementById('editar-rep-capacidad').value),
        activo: document.getElementById('editar-rep-activo').value === 'true'
      }
    }),
    'Repartidor actualizado correctamente.'
  );
});

// Actualizar formularios al cambiar de registro.
document.getElementById('editar-zona-codigo')
  .addEventListener('change', mostrarZonaSeleccionada);

document.getElementById('editar-rep-codigo')
  .addEventListener('change', mostrarRepartidorSeleccionado);

// Cargar los datos al abrir el panel administrativo.
async function iniciar() {
  try {
    await cargarZonas();
    await cargarRepartidores();
  } catch (error) {
    notificar('mensaje--error', error.message);
  }
}

iniciar();
