// Pruebas de los contratos compartidos (no necesitan Docker).
// Ejecutar desde la raíz del proyecto:  node --test tests/contratos.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ESTADOS, esTransicionValida, validarTransicion } = require('../backend/src/shared/estados');
const ids = require('../backend/src/shared/identificadores');
const { validar } = require('../backend/src/shared/validacion');
const { AppError } = require('../backend/src/shared/errores');

test('estados: la secuencia normal es válida', () => {
  const secuencia = ['CREADO', 'ACEPTADO', 'ASIGNADO', 'RETIRADO', 'EN_TRANSITO', 'ENTREGADO'];
  for (let i = 0; i < secuencia.length - 1; i += 1) {
    assert.ok(esTransicionValida(secuencia[i], secuencia[i + 1]), `${secuencia[i]} → ${secuencia[i + 1]}`);
  }
});

test('estados: CREADO → ENTREGADO se rechaza con 409 TRANSICION_INVALIDA', () => {
  assert.throws(() => validarTransicion(ESTADOS.CREADO, ESTADOS.ENTREGADO), (e) => {
    assert.ok(e instanceof AppError);
    assert.equal(e.status, 409);
    assert.equal(e.codigo, 'TRANSICION_INVALIDA');
    return true;
  });
});

test('estados: ENTREGADO y CANCELADO son finales', () => {
  for (const final of ['ENTREGADO', 'CANCELADO']) {
    for (const destino of Object.values(ESTADOS)) {
      assert.equal(esTransicionValida(final, destino), false, `${final} → ${destino}`);
    }
  }
});

test('estados: un estado inexistente es error de validación (400)', () => {
  assert.throws(() => validarTransicion('CREADO', 'PERDIDO'), (e) => e.status === 400);
});

test('identificadores: el código generado cumple el formato y no tiene caracteres confusos', () => {
  for (let i = 0; i < 1000; i += 1) {
    const codigo = ids.generarCodigoEnvio();
    assert.match(codigo, ids.PATRON_CODIGO_ENVIO);
    assert.doesNotMatch(codigo.slice(4), /[01OIL]/);
  }
});

test('identificadores: 10 000 códigos generados no se repiten', () => {
  const codigos = new Set(Array.from({ length: 10000 }, () => ids.generarCodigoEnvio()));
  assert.equal(codigos.size, 10000);
});

test('identificadores: se normalizan minúsculas y espacios', () => {
  assert.equal(ids.normalizarCodigo('  env-7k3p9qxm '), 'ENV-7K3P9QXM');
  assert.ok(ids.esCodigoEnvio(' env-7k3p9qxm'));
  assert.equal(ids.esCodigoEnvio('ENV-0000000O'), false);
  assert.ok(ids.esCodigoRepartidor('rep-001'));
  assert.equal(ids.esCodigoRepartidor('REP-1'), false);
});

test('validación: limpia los datos y descarta campos no definidos', () => {
  const datos = validar(
    { nombre: '  Ana   Ficticia ', peso_kg: '2.5', tipo: 'express', precio: 0, es_admin: true },
    {
      nombre: { tipo: 'texto', requerido: true, min: 2, max: 80 },
      peso_kg: { tipo: 'numero', requerido: true, min: 0.1, max: 20 },
      tipo: { tipo: 'opcion', requerido: true, opciones: ['ESTANDAR', 'EXPRESS'] },
      nota: { tipo: 'texto', max: 200, porDefecto: '' },
    },
  );
  assert.deepEqual(datos, { nombre: 'Ana Ficticia', peso_kg: 2.5, tipo: 'EXPRESS', nota: '' });
});

test('validación: devuelve un detalle por cada campo con error', () => {
  assert.throws(
    () => validar({ nombre: 'A', peso_kg: 'mucho' }, {
      nombre: { tipo: 'texto', requerido: true, min: 2 },
      peso_kg: { tipo: 'numero', requerido: true },
      zona: { tipo: 'opcion', requerido: true, opciones: ['NORTE'] },
    }),
    (e) => {
      assert.equal(e.status, 400);
      assert.equal(e.codigo, 'VALIDACION');
      assert.deepEqual(e.detalles.map((d) => d.campo), ['nombre', 'peso_kg', 'zona']);
      return true;
    },
  );
});

test('validación: rechaza un cuerpo que no es objeto', () => {
  assert.throws(() => validar(null, {}), (e) => e.status === 400);
  assert.throws(() => validar([1, 2], {}), (e) => e.status === 400);
});
