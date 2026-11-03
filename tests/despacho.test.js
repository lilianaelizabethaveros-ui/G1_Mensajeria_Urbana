
 // Pruebas del Dominio 2: despacho y asignaciones.
 // Requiere Docker y la API en ejecución.
 // Ejecutar: node --test tests/despacho.test.js
 // Crea registros ficticios de prueba que permanecen en PostgreSQL.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomInt } = require('node:crypto');

const API = process.env.API_URL || 'http://localhost:3000';

// Cliente HTTP con el mismo formato de las pruebas del equipo.
async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      Accept: 'application/json',
      ...(cuerpo ? { 'Content-Type': 'application/json' } : {})
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });

  const json = await respuesta.json().catch(() => null);

  return {
    status: respuesta.status,
    cuerpo: json
  };
}

// Crear un envío ficticio y dejarlo ACEPTADO.
async function crearEnvioAceptado() {
  const respuesta = await pedir('/api/envios', {
    metodo: 'POST',
    cuerpo: {
      remitente_nombre: 'Ana Ficticia',
      remitente_telefono: '0990000001',
      origen_direccion: 'Calle Ficticia 123',
      origen_zona: 'NORTE',
      destinatario_nombre: 'Luis Inventado',
      destinatario_telefono: '0990000002',
      destino_direccion: 'Pasaje Ejemplo 45',
      destino_zona: 'CENTRO',
      tipo_servicio: 'ESTANDAR',
      descripcion: '[PRUEBA] Despacho automatizado',
      peso_kg: 2
    }
  });

  assert.equal(
    respuesta.status,
    201,
    JSON.stringify(respuesta.cuerpo)
  );

  const codigo = respuesta.cuerpo.datos.codigo;

  const aceptado = await pedir(
    `/api/envios/${codigo}/aceptar`,
    { metodo: 'PATCH' }
  );

  assert.equal(aceptado.status, 200);
  assert.equal(aceptado.cuerpo.datos.estado, 'ACEPTADO');

  return codigo;
}

// Crear un repartidor exclusivo para las pruebas.
// Si el código aleatorio existe, intentar con otro.
async function crearRepartidor(capacidad) {
  for (let intento = 0; intento < 30; intento++) {
    const codigo = `REP-${randomInt(100, 1000)}`;

    const respuesta = await pedir(
      '/api/despacho/admin/repartidores',
      {
        metodo: 'POST',
        cuerpo: {
          codigo,
          nombre: 'Repartidor de Prueba',
          zona: 'CENTRO',
          capacidad_maxima: capacidad
        }
      }
    );

    if (respuesta.status === 201) {
      return codigo;
    }

    if (
      respuesta.status !== 409 ||
      respuesta.cuerpo?.error?.codigo !== 'REPARTIDOR_DUPLICADO'
    ) {
      assert.fail(JSON.stringify(respuesta.cuerpo));
    }
  }

  assert.fail('No se encontró un código libre para el repartidor.');
}

async function asignar(codigoEnvio, codigoRepartidor) {
  return pedir('/api/despacho/asignaciones', {
    metodo: 'POST',
    cuerpo: {
      codigo_envio: codigoEnvio,
      codigo_repartidor: codigoRepartidor
    }
  });
}

async function totalOutbox() {
  const respuesta = await pedir('/health');

  assert.equal(respuesta.status, 200);

  return respuesta.cuerpo.datos.outbox.total;
}

// Pruebas secuenciales para conservar la relación entre operaciones.
test('Dominio 2: despacho y asignaciones', async (t) => {
  const repartidorUno = await crearRepartidor(1);
  const repartidorDos = await crearRepartidor(2);

  const envioUno = await crearEnvioAceptado();
  const envioDos = await crearEnvioAceptado();
  const envioTres = await crearEnvioAceptado();
  const envioCuatro = await crearEnvioAceptado();

  await t.test('Asignación válida: ACEPTADO a ASIGNADO', async () => {
    const respuesta = await asignar(envioUno, repartidorUno);

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.cuerpo.ok, true);
    assert.equal(respuesta.cuerpo.datos.estado, 'ASIGNADO');
    assert.equal(
      respuesta.cuerpo.datos.repartidor.codigo,
      repartidorUno
    );
  });

  await t.test('D33: repetir la asignación devuelve 200', async () => {
    const eventosAntes = await totalOutbox();

    const respuesta = await asignar(envioUno, repartidorUno);

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.cuerpo.datos.idempotente, true);
    assert.equal(await totalOutbox(), eventosAntes);
  });

  await t.test('Capacidad agotada: responde 409', async () => {
    const respuesta = await asignar(envioDos, repartidorUno);

    assert.equal(respuesta.status, 409);
    assert.equal(
      respuesta.cuerpo.error.codigo,
      'CAPACIDAD_AGOTADA'
    );

    const pendientes = await pedir('/api/despacho/pendientes');

    assert.equal(pendientes.status, 200);
    assert.ok(
      pendientes.cuerpo.datos.some(
        envio => envio.codigo === envioDos
      )
    );
  });

  await t.test('Preparar el último cupo', async () => {
    const respuesta = await asignar(envioDos, repartidorDos);

    assert.equal(respuesta.status, 201);
  });

  await t.test('Dos asignaciones simultáneas: solo una gana', async () => {
    const resultados = await Promise.all([
      asignar(envioTres, repartidorDos),
      asignar(envioCuatro, repartidorDos)
    ]);

    const exitosas = resultados.filter(r => r.status === 201);
    const rechazadas = resultados.filter(r => r.status === 409);

    assert.equal(exitosas.length, 1);
    assert.equal(rechazadas.length, 1);
    assert.equal(
      rechazadas[0].cuerpo.error.codigo,
      'CAPACIDAD_AGOTADA'
    );

    // Liberar el cupo usado en la prueba de concurrencia.
    const codigoGanador = exitosas[0].cuerpo.datos.codigo_envio;

    const liberacion = await pedir(
      `/api/despacho/asignaciones/${codigoGanador}/liberar`,
      { metodo: 'PATCH' }
    );

    assert.equal(liberacion.status, 200);
    assert.equal(liberacion.cuerpo.datos.estado, 'ACEPTADO');
  });

  await t.test('Reasignar a otro repartidor disponible', async () => {
    const respuesta = await pedir(
      `/api/despacho/asignaciones/${envioUno}/reasignar`,
      {
        metodo: 'PATCH',
        cuerpo: {
          codigo_repartidor: repartidorDos
        }
      }
    );

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.cuerpo.datos.estado, 'ASIGNADO');
    assert.equal(
      respuesta.cuerpo.datos.repartidor_anterior,
      repartidorUno
    );
    assert.equal(
      respuesta.cuerpo.datos.repartidor_nuevo,
      repartidorDos
    );
  });

  await t.test('Liberar: ASIGNADO a ACEPTADO', async () => {
    const respuesta = await pedir(
      `/api/despacho/asignaciones/${envioUno}/liberar`,
      { metodo: 'PATCH' }
    );

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.cuerpo.datos.estado, 'ACEPTADO');

    const pendientes = await pedir('/api/despacho/pendientes');

    assert.ok(
      pendientes.cuerpo.datos.some(
        envio => envio.codigo === envioUno
      )
    );
  });

  await t.test('Consulta de carga de repartidores', async () => {
    const respuesta = await pedir('/api/despacho/repartidores');

    assert.equal(respuesta.status, 200);

    const primero = respuesta.cuerpo.datos.find(
      repartidor => repartidor.codigo === repartidorUno
    );

    const segundo = respuesta.cuerpo.datos.find(
      repartidor => repartidor.codigo === repartidorDos
    );

    assert.equal(primero.carga_actual, 0);
    assert.equal(primero.cupos_disponibles, 1);

    assert.equal(segundo.carga_actual, 1);
    assert.equal(segundo.cupos_disponibles, 1);
  });

  await t.test('Las pantallas del Dominio 2 están disponibles', async () => {
    for (const pagina of ['index.html', 'admin.html']) {
      const respuesta = await fetch(`${API}/despacho/${pagina}`);

      assert.equal(respuesta.status, 200, pagina);
    }
  });
});
