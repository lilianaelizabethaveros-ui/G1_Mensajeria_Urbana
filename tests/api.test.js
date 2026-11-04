// Pruebas de la API en ejecución (requiere "docker compose up --build -d").
// Ejecutar desde la raíz del proyecto:  node --test tests/api.test.js
// Otra URL:  $env:API_URL="http://localhost:3001"; node --test tests/api.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:3000';

async function pedir(ruta, opciones = {}) {
  const respuesta = await fetch(`${API}${ruta}`, opciones);
  const cuerpo = await respuesta.json().catch(() => null);
  return { status: respuesta.status, cuerpo };
}

test('GET /health: 200 con los tres gestores ok, outbox y migraciones', async () => {
  const { status, cuerpo } = await pedir('/health');
  assert.equal(status, 200, JSON.stringify(cuerpo));
  assert.equal(cuerpo.ok, true);
  for (const gestor of ['postgres', 'mongo', 'redis']) {
    assert.equal(cuerpo.datos.gestores[gestor].estado, 'ok', gestor);
  }
  assert.equal(typeof cuerpo.datos.outbox.pendientes, 'number');
  assert.ok(cuerpo.datos.migraciones.aplicadas >= 2);
});

test('GET /health: no expone credenciales', async () => {
  const { cuerpo } = await pedir('/health');
  const texto = JSON.stringify(cuerpo).toLowerCase();
  for (const palabra of ['password', 'clave', 'mongodb://', 'cambia_esta']) {
    assert.equal(texto.includes(palabra), false, palabra);
  }
});

test('Ruta /api inexistente: 404 con formato de error uniforme', async () => {
  const { status, cuerpo } = await pedir('/api/no-existe');
  assert.equal(status, 404);
  assert.equal(cuerpo.ok, false);
  assert.equal(cuerpo.error.codigo, 'NO_ENCONTRADO');
});



test('Todos los módulos implementados: despacho, consulta, seguimiento, evidencias y estado temporal', async () => {
  // Verificar el Dominio 2: despacho.
  const despacho = await pedir('/api/despacho/repartidores');

  assert.equal(despacho.status, 200);
  assert.equal(despacho.cuerpo.ok, true);
  assert.ok(Array.isArray(despacho.cuerpo.datos));

  // Verificar el Dominio 5: consulta operativa.
  const consulta = await pedir('/api/consulta?limite=5');

  assert.equal(consulta.status, 200);
  assert.equal(consulta.cuerpo.ok, true);
  assert.ok(Array.isArray(consulta.cuerpo.datos.resultados));
  assert.equal(consulta.cuerpo.datos.paginacion.limite, 5);

  // Dominios 3, 4 y 6 (antes pendientes con 501): ya responden.
  for (const ruta of [
    '/api/seguimiento/sincronizador',
    '/api/evidencias/huerfanas',
    '/api/estado-temporal/repartidores',
  ]) {
    const { status, cuerpo } = await pedir(ruta);

    assert.equal(status, 200, ruta);
    assert.equal(cuerpo.ok, true, ruta);
  }
});

test('JSON mal formado: 400 JSON_INVALIDO', async () => {
  const { status, cuerpo } = await pedir('/api/despacho', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"esto no es": json',
  });
  assert.equal(status, 400);
  assert.equal(cuerpo.error.codigo, 'JSON_INVALIDO');
});

test('La web de inicio se sirve desde la API', async () => {
  const respuesta = await fetch(`${API}/`);
  assert.equal(respuesta.status, 200);
  assert.match(await respuesta.text(), /Mensajería Urbana/);
});
