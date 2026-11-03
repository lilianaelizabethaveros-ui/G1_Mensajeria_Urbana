
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const API = process.env.API_URL || 'http://localhost:3000';

// Realizar solicitudes HTTP a la API.
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

// Generar un nombre ficticio diferente para cada ejecución.
function nombrePrueba() {
  const identificador = randomUUID()
    .replace(/-/g, '')
    .replace(/[0-9]/g, 'a')
    .slice(0, 12);

  return `Persona Consulta ${identificador}`;
}

// Registrar un envío ficticio para las pruebas.
async function crearEnvio(destinatario, zonaDestino) {
  const respuesta = await pedir('/api/envios', {
    metodo: 'POST',
    cuerpo: {
      remitente_nombre: 'Ana Ficticia',
      remitente_telefono: '0990000001',
      origen_direccion: 'Calle Ficticia 123',
      origen_zona: 'NORTE',
      destinatario_nombre: destinatario,
      destinatario_telefono: '0990000002',
      destino_direccion: 'Pasaje Ejemplo 45',
      destino_zona: zonaDestino,
      tipo_servicio: 'ESTANDAR',
      descripcion: '[PRUEBA] Consulta operativa',
      peso_kg: 2
    }
  });

  assert.equal(
    respuesta.status,
    201,
    JSON.stringify(respuesta.cuerpo)
  );

  return respuesta.cuerpo.datos.codigo;
}

// Aceptar un envío para comprobar los filtros por estado.
async function aceptarEnvio(codigo) {
  const respuesta = await pedir(
    `/api/envios/${codigo}/aceptar`,
    { metodo: 'PATCH' }
  );

  assert.equal(
    respuesta.status,
    200,
    JSON.stringify(respuesta.cuerpo)
  );

  assert.equal(respuesta.cuerpo.datos.estado, 'ACEPTADO');
}

// Consultar el módulo de búsqueda con filtros.
async function consultar(filtros = {}) {
  const parametros = new URLSearchParams(filtros);
  const ruta = `/api/consulta?${parametros.toString()}`;

  return pedir(ruta);
}

// Confirmar que una respuesta contiene el envío esperado.
function contieneEnvio(respuesta, codigo) {
  assert.equal(
    respuesta.status,
    200,
    JSON.stringify(respuesta.cuerpo)
  );

  assert.equal(respuesta.cuerpo.ok, true);

  assert.ok(
    respuesta.cuerpo.datos.resultados.some(
      envio => envio.codigo === codigo
    ),
    `No se encontró el envío ${codigo}`
  );
}

// Ejecutar las pruebas de consulta operativa.
test('Dominio 5: consulta operativa', async (t) => {
  const destinatarioUno = nombrePrueba();
  const destinatarioDos = nombrePrueba();

  const envioUno = await crearEnvio(
    destinatarioUno,
    'CENTRO'
  );

  const envioDos = await crearEnvio(
    destinatarioDos,
    'SUR'
  );

  await aceptarEnvio(envioUno);

  await t.test('Consultar todos los envíos', async () => {
    const respuesta = await consultar();

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.cuerpo.ok, true);

    assert.ok(
      Array.isArray(respuesta.cuerpo.datos.resultados)
    );

    assert.ok(
      respuesta.cuerpo.datos.paginacion.total >= 2
    );
  });

  await t.test('Buscar por código exacto', async () => {
    const respuesta = await consultar({
      codigo: envioUno
    });

    contieneEnvio(respuesta, envioUno);

    assert.equal(
      respuesta.cuerpo.datos.paginacion.total,
      1
    );
  });

  await t.test('Buscar por código parcial', async () => {
    const respuesta = await consultar({
      codigo: envioUno.slice(0, 8)
    });

    contieneEnvio(respuesta, envioUno);
  });

  await t.test('Filtrar por zona de destino', async () => {
    const respuesta = await consultar({
      codigo: envioUno,
      zona: 'CENTRO'
    });

    contieneEnvio(respuesta, envioUno);

    assert.equal(
      respuesta.cuerpo.datos.resultados[0].destino_zona,
      'CENTRO'
    );
  });

  await t.test('Filtrar por estado ACEPTADO', async () => {
    const respuesta = await consultar({
      codigo: envioUno,
      estado: 'ACEPTADO'
    });

    contieneEnvio(respuesta, envioUno);

    assert.equal(
      respuesta.cuerpo.datos.resultados[0].estado,
      'ACEPTADO'
    );
  });

  await t.test('Filtrar por estado CREADO', async () => {
    const respuesta = await consultar({
      codigo: envioDos,
      estado: 'CREADO'
    });

    contieneEnvio(respuesta, envioDos);

    assert.equal(
      respuesta.cuerpo.datos.resultados[0].estado,
      'CREADO'
    );
  });

  await t.test('Buscar por destinatario ficticio', async () => {
    const respuesta = await consultar({
      destinatario: destinatarioUno
    });

    contieneEnvio(respuesta, envioUno);
  });

  await t.test('Combinar código, zona y estado', async () => {
    const respuesta = await consultar({
      codigo: envioUno,
      zona: 'CENTRO',
      estado: 'ACEPTADO'
    });

    contieneEnvio(respuesta, envioUno);

    assert.equal(
      respuesta.cuerpo.datos.paginacion.total,
      1
    );
  });

  await t.test('Combinación que no coincide devuelve lista vacía', async () => {
    const respuesta = await consultar({
      codigo: envioUno,
      zona: 'SUR'
    });

    assert.equal(respuesta.status, 200);

    assert.deepEqual(
      respuesta.cuerpo.datos.resultados,
      []
    );

    assert.equal(
      respuesta.cuerpo.datos.paginacion.total,
      0
    );
  });

  await t.test('Filtrar por rango de fechas', async () => {
    const respuesta = await consultar({
      codigo: envioUno,
      fecha_desde: '2020-01-01',
      fecha_hasta: '2099-12-31'
    });

    contieneEnvio(respuesta, envioUno);
  });

  await t.test('Rango de fechas sin coincidencias', async () => {
    const respuesta = await consultar({
      codigo: envioUno,
      fecha_desde: '2020-01-01',
      fecha_hasta: '2020-01-02'
    });

    assert.equal(respuesta.status, 200);

    assert.equal(
      respuesta.cuerpo.datos.paginacion.total,
      0
    );
  });

  await t.test('Rechazar una fecha inexistente', async () => {
    const respuesta = await consultar({
      fecha_desde: '2026-02-30'
    });

    assert.equal(respuesta.status, 400);
    assert.equal(
      respuesta.cuerpo.error.codigo,
      'VALIDACION'
    );
  });

  await t.test('Rechazar fechas en orden incorrecto', async () => {
    const respuesta = await consultar({
      fecha_desde: '2026-11-10',
      fecha_hasta: '2026-11-01'
    });

    assert.equal(respuesta.status, 400);
    assert.equal(
      respuesta.cuerpo.error.codigo,
      'VALIDACION'
    );
  });

  await t.test('Rechazar estado inexistente', async () => {
    const respuesta = await consultar({
      estado: 'DESCONOCIDO'
    });

    assert.equal(respuesta.status, 400);
    assert.equal(
      respuesta.cuerpo.error.codigo,
      'VALIDACION'
    );
  });

  await t.test('Rechazar paginación inválida', async () => {
    const respuesta = await consultar({
      pagina: '0',
      limite: '200'
    });

    assert.equal(respuesta.status, 400);
    assert.equal(
      respuesta.cuerpo.error.codigo,
      'VALIDACION'
    );
  });

  await t.test('Paginación con límite de un resultado', async () => {
    const respuesta = await consultar({
      limite: '1',
      pagina: '1'
    });

    assert.equal(respuesta.status, 200);

    assert.equal(
      respuesta.cuerpo.datos.resultados.length,
      1
    );

    assert.equal(
      respuesta.cuerpo.datos.paginacion.limite,
      1
    );

    assert.ok(
      respuesta.cuerpo.datos.paginacion.total_paginas >= 2
    );
  });

  await t.test('La pantalla de consulta está disponible', async () => {
    const respuesta = await fetch(
      `${API}/despacho/consulta.html`
    );

    assert.equal(respuesta.status, 200);
  });
});
