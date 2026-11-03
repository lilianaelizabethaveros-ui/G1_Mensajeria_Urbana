// Pruebas del Dominio 1 (solicitudes y envíos) contra la API en ejecución.
// Requiere los contenedores levantados. Desde la raíz del proyecto:
//   node --test tests/envios.test.js
// Con todos los archivos: node --test --test-concurrency=1 "tests/*.test.js"
// (uno a la vez: varias pruebas cuentan el total de eventos de la outbox y otro
// módulo que escriba eventos en paralelo alteraría la cuenta).
// Cada ejecución crea unos pocos envíos FICTICIOS marcados con "[PRUEBA]" en la
// descripción. No borra nada: quedan como datos de prueba en el volumen local.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const API = process.env.API_URL || 'http://localhost:3000';
const PATRON_CODIGO = /^ENV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

async function pedir(ruta, { metodo = 'GET', cuerpo, encabezados = {} } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...encabezados },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await respuesta.json().catch(() => null);
  return { status: respuesta.status, cuerpo: json, encabezados: respuesta.headers };
}

function solicitudValida(cambios = {}) {
  return {
    remitente_nombre: 'Ana Ficticia',
    remitente_telefono: '0990000001',
    origen_direccion: 'Calle Ficticia 123',
    origen_zona: 'NORTE',
    destinatario_nombre: 'Luis Inventado',
    destinatario_telefono: '0990000002',
    destino_direccion: 'Pasaje Ejemplo 45',
    destino_zona: 'SUR',
    tipo_servicio: 'ESTANDAR',
    descripcion: '[PRUEBA] Caja con libros',
    peso_kg: 2.5,
    ...cambios,
  };
}

async function crear(cambios, clave) {
  const r = await pedir('/api/envios', {
    metodo: 'POST',
    cuerpo: solicitudValida(cambios),
    encabezados: clave ? { 'Idempotency-Key': clave } : {},
  });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  return r.cuerpo.datos;
}

async function totalOutbox() {
  const { cuerpo } = await pedir('/health');
  return cuerpo.datos.outbox.total;
}

// ---------- Catálogos ----------
test('GET /api/catalogos: zonas y tipos de servicio activos, sin ids internos', async () => {
  const { status, cuerpo } = await pedir('/api/catalogos');
  assert.equal(status, 200);
  const { zonas, tipos_servicio: tipos } = cuerpo.datos;
  assert.deepEqual(zonas.map((z) => z.codigo), ['NORTE', 'CENTRO', 'SUR', 'VALLE']);
  assert.ok(tipos.some((t) => t.codigo === 'EXPRESS' && t.peso_maximo_kg === 10));
  assert.equal('id' in zonas[0], false);
  assert.equal('id' in tipos[0], false);
});

// ---------- Registro ----------
test('POST /api/envios: 201, código ENV-XXXXXXXX, estado CREADO y Location', async () => {
  const r = await pedir('/api/envios', { metodo: 'POST', cuerpo: solicitudValida() });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  const envio = r.cuerpo.datos;
  assert.match(envio.codigo, PATRON_CODIGO);
  assert.equal(envio.estado, 'CREADO');
  assert.equal(r.encabezados.get('location'), `/api/envios/${envio.codigo}`);
  assert.equal(envio.origen.zona.codigo, 'NORTE');
  assert.equal(envio.destino.zona.codigo, 'SUR');
  assert.equal(envio.paquete.peso_kg, 2.5);
  assert.deepEqual(envio.transiciones_permitidas, ['ACEPTADO', 'CANCELADO']);
  assert.ok(new Date(envio.entrega_estimada) > new Date(envio.fechas.creado_en));
});

test('POST /api/envios: registra el evento CREADO en la outbox (misma transacción)', async () => {
  const antes = await totalOutbox();
  await crear();
  assert.equal(await totalOutbox(), antes + 1);
});

test('POST /api/envios: ignora campos que el cliente no puede decidir (estado, precio)', async () => {
  const envio = await crear({ estado: 'ENTREGADO', precio: 0, codigo: 'ENV-AAAAAAAA' });
  assert.equal(envio.estado, 'CREADO');
  assert.notEqual(envio.codigo, 'ENV-AAAAAAAA');
  assert.equal('precio' in envio, false);
});

test('POST /api/envios: acepta códigos de catálogo en minúsculas', async () => {
  const envio = await crear({ origen_zona: 'centro', destino_zona: 'valle', tipo_servicio: 'express' });
  assert.equal(envio.origen.zona.codigo, 'CENTRO');
  assert.equal(envio.tipo_servicio.codigo, 'EXPRESS');
});

test('POST /api/envios: la misma Idempotency-Key no duplica el envío', async () => {
  const clave = randomUUID();
  const primero = await crear({}, clave);
  const antes = await totalOutbox();
  const repetido = await pedir('/api/envios', {
    metodo: 'POST', cuerpo: solicitudValida(), encabezados: { 'Idempotency-Key': clave },
  });
  assert.equal(repetido.status, 200);
  assert.equal(repetido.cuerpo.repetido, true);
  assert.equal(repetido.cuerpo.datos.codigo, primero.codigo);
  assert.equal(await totalOutbox(), antes, 'no debe registrar un segundo evento CREADO');
});

test('POST /api/envios: Idempotency-Key con formato inválido → 400', async () => {
  const r = await pedir('/api/envios', {
    metodo: 'POST', cuerpo: solicitudValida(), encabezados: { 'Idempotency-Key': 'no-es-uuid' },
  });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error.codigo, 'VALIDACION');
});

test('POST /api/envios: campos obligatorios vacíos → 400 con detalle por campo', async () => {
  const r = await pedir('/api/envios', { metodo: 'POST', cuerpo: {} });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.ok, false);
  assert.equal(r.cuerpo.error.codigo, 'VALIDACION');
  const campos = r.cuerpo.error.detalles.map((d) => d.campo);
  for (const campo of ['remitente_nombre', 'destino_zona', 'tipo_servicio', 'peso_kg']) {
    assert.ok(campos.includes(campo), campo);
  }
});

test('POST /api/envios: teléfono y peso inválidos → 400', async () => {
  const r = await pedir('/api/envios', {
    metodo: 'POST', cuerpo: solicitudValida({ remitente_telefono: '12345', peso_kg: -1 }),
  });
  assert.equal(r.status, 400);
  const campos = r.cuerpo.error.detalles.map((d) => d.campo);
  assert.ok(campos.includes('remitente_telefono'));
  assert.ok(campos.includes('peso_kg'));
});

test('POST /api/envios: peso mayor al máximo del servicio → 400 (regla en el servidor)', async () => {
  const r = await pedir('/api/envios', {
    metodo: 'POST', cuerpo: solicitudValida({ tipo_servicio: 'DOCUMENTOS', peso_kg: 5 }),
  });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error.detalles[0].campo, 'peso_kg');
});

test('POST /api/envios: zona inexistente → 400', async () => {
  const r = await pedir('/api/envios', { metodo: 'POST', cuerpo: solicitudValida({ destino_zona: 'MARTE' }) });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error.detalles[0].campo, 'destino_zona');
});

test('POST /api/envios: origen y destino idénticos → 400', async () => {
  const r = await pedir('/api/envios', {
    metodo: 'POST',
    cuerpo: solicitudValida({ destino_zona: 'NORTE', destino_direccion: 'calle ficticia 123' }),
  });
  assert.equal(r.status, 400);
  assert.equal(r.cuerpo.error.detalles[0].campo, 'destino_direccion');
});

// ---------- Consulta ----------
test('GET /api/envios/:codigo: devuelve el envío (acepta minúsculas)', async () => {
  const creado = await crear();
  const r = await pedir(`/api/envios/${creado.codigo.toLowerCase()}`);
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.datos.codigo, creado.codigo);
  assert.equal(r.cuerpo.datos.remitente.nombre, 'Ana Ficticia');
});

test('GET /api/envios/:codigo: formato inválido → 400; inexistente → 404', async () => {
  const invalido = await pedir('/api/envios/ABC');
  assert.equal(invalido.status, 400);
  const inexistente = await pedir('/api/envios/ENV-22222222');
  assert.equal(inexistente.status, 404);
  assert.equal(inexistente.cuerpo.error.codigo, 'NO_ENCONTRADO');
});

// ---------- Cambios de estado ----------
test('PATCH aceptar: CREADO → ACEPTADO, y repetirlo no genera otro evento', async () => {
  const { codigo } = await crear();
  const antes = await totalOutbox();

  const r = await pedir(`/api/envios/${codigo}/aceptar`, { metodo: 'PATCH' });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.cambiado, true);
  assert.equal(r.cuerpo.datos.estado, 'ACEPTADO');
  assert.ok(r.cuerpo.datos.fechas.aceptado_en);
  assert.equal(await totalOutbox(), antes + 1);

  const otraVez = await pedir(`/api/envios/${codigo}/aceptar`, { metodo: 'PATCH' });
  assert.equal(otraVez.status, 200);
  assert.equal(otraVez.cuerpo.cambiado, false);
  assert.equal(await totalOutbox(), antes + 1);
});

test('PATCH cancelar: exige motivo (400) y luego cancela con motivo', async () => {
  const { codigo } = await crear();

  const sinMotivo = await pedir(`/api/envios/${codigo}/cancelar`, { metodo: 'PATCH', cuerpo: {} });
  assert.equal(sinMotivo.status, 400);

  const r = await pedir(`/api/envios/${codigo}/cancelar`, {
    metodo: 'PATCH', cuerpo: { motivo: 'El cliente ya no lo necesita', actor: 'CLIENTE' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.datos.estado, 'CANCELADO');
  assert.equal(r.cuerpo.datos.motivo_cancelacion, 'El cliente ya no lo necesita');
  assert.equal(r.cuerpo.datos.entrega_estimada, null);
  assert.deepEqual(r.cuerpo.datos.transiciones_permitidas, []);
});

test('PATCH aceptar sobre un envío CANCELADO → 409 TRANSICION_INVALIDA', async () => {
  const { codigo } = await crear();
  await pedir(`/api/envios/${codigo}/cancelar`, { metodo: 'PATCH', cuerpo: { motivo: 'Prueba de conflicto' } });
  const r = await pedir(`/api/envios/${codigo}/aceptar`, { metodo: 'PATCH' });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.error.codigo, 'TRANSICION_INVALIDA');
});

test('PATCH cancelar sobre un envío ACEPTADO también es válido', async () => {
  const { codigo } = await crear();
  await pedir(`/api/envios/${codigo}/aceptar`, { metodo: 'PATCH' });
  const r = await pedir(`/api/envios/${codigo}/cancelar`, {
    metodo: 'PATCH', cuerpo: { motivo: 'Cambio de planes', actor: 'OPERADOR' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.datos.estado, 'CANCELADO');
});

// ---------- Pantallas ----------
test('Las pantallas del Dominio 1 se sirven desde la API', async () => {
  for (const pagina of ['solicitud', 'confirmacion', 'consulta']) {
    const respuesta = await fetch(`${API}/envios/${pagina}.html`);
    assert.equal(respuesta.status, 200, pagina);
  }
});
