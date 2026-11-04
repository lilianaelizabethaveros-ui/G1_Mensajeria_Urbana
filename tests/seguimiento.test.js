// Pruebas de los Dominios 3, 4 y 6: seguimiento, evidencias y estado temporal.
// Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38).
// Requiere los contenedores levantados. Desde la raíz del proyecto:
//   node --test tests/seguimiento.test.js
// Con todos los archivos: node --test --test-concurrency=1 "tests/*.test.js"
// Crea envíos y un repartidor FICTICIOS ("[PRUEBA]"); no borra nada.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomInt, randomUUID } = require('node:crypto');

const API = process.env.API_URL || 'http://localhost:3000';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Accept: 'application/json', ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await respuesta.json().catch(() => null);
  return { status: respuesta.status, cuerpo: json };
}

// Un repartidor exclusivo por ejecución, en la zona CENTRO, para no depender de la carga de otros.
let repartidorDePrueba;
async function repartidor() {
  if (repartidorDePrueba) return repartidorDePrueba;
  for (let intento = 0; intento < 40; intento += 1) {
    const codigo = `REP-${randomInt(100, 1000)}`;
    const r = await pedir('/api/despacho/admin/repartidores', {
      metodo: 'POST',
      cuerpo: { codigo, nombre: 'Repartidor Ficticio Seguimiento', zona: 'CENTRO', capacidad_maxima: 10 },
    });
    if (r.status === 201 || r.status === 200) {
      repartidorDePrueba = codigo;
      return codigo;
    }
    assert.equal(r.status, 409, JSON.stringify(r.cuerpo));
  }
  throw new Error('No se pudo crear un repartidor de prueba');
}

/** Crea un envío y lo deja ASIGNADO al repartidor de prueba. */
async function envioAsignado() {
  const creado = await pedir('/api/envios', {
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
      descripcion: '[PRUEBA] Seguimiento automatizado',
      peso_kg: 1.5,
    },
  });
  assert.equal(creado.status, 201, JSON.stringify(creado.cuerpo));
  const codigo = creado.cuerpo.datos.codigo;
  assert.equal((await pedir(`/api/envios/${codigo}/aceptar`, { metodo: 'PATCH' })).status, 200);
  const rep = await repartidor();
  const asignado = await pedir('/api/despacho/asignaciones', {
    metodo: 'POST', cuerpo: { codigo_envio: codigo, codigo_repartidor: rep },
  });
  assert.equal(asignado.status, 201, JSON.stringify(asignado.cuerpo));
  return { codigo, rep };
}

const cambiar = (codigo, cuerpo) => pedir(`/api/seguimiento/${codigo}/eventos`, { metodo: 'POST', cuerpo });

function evidencia(codigo, rep, cambios = {}) {
  return {
    clave_evidencia: randomUUID(),
    codigo_envio: codigo,
    repartidor: rep,
    receptor_tipo: 'DESTINATARIO',
    receptor_nombre: 'Luis Inventado',
    observacion: '[PRUEBA] Entregado en mano',
    foto_referencia: `SIM-FOTO-${codigo}`,
    ubicacion_x: 40.5,
    ubicacion_y: 61.2,
    ...cambios,
  };
}

/** Espera a que el sincronizador copie todos los eventos del envío a MongoDB. */
async function seguimientoAlDia(codigo, limiteMs = 15000) {
  const fin = Date.now() + limiteMs;
  for (;;) {
    const r = await pedir(`/api/seguimiento/${codigo}`);
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo));
    if (r.cuerpo.datos.historial.al_dia) return r.cuerpo.datos;
    if (Date.now() > fin) throw new Error(`El historial de ${codigo} no se sincronizó a tiempo`);
    await esperar(500);
  }
}

async function cargaDe(rep) {
  const r = await pedir('/api/despacho/repartidores');
  return r.cuerpo.datos.find((x) => x.codigo === rep).carga_actual;
}

// ---------- Dominio 3: seguimiento ----------

test('sincronizador: está activo y la línea de tiempo coincide con la outbox (sin duplicados)', async () => {
  const { codigo } = await envioAsignado();
  const datos = await seguimientoAlDia(codigo);
  assert.equal(datos.historial.disponible, true);
  assert.equal(datos.historial.eventos.length, datos.historial.eventos_oficiales);
  assert.deepEqual(datos.historial.eventos.map((e) => e.tipo), ['CREADO', 'ACEPTADO', 'ASIGNADO']);
  assert.equal(datos.historial.coherente, true);
  assert.equal(datos.estado_vigente.estado, 'ASIGNADO');
  assert.equal(datos.estado_vigente.fuente, 'PostgreSQL');

  const sinc = await pedir('/api/seguimiento/sincronizador');
  assert.equal(sinc.cuerpo.datos.activo, true);
});

test('secuencia válida: retiro → tránsito → incidencia → tránsito, con orden y autor', async () => {
  const { codigo, rep } = await envioAsignado();
  for (const paso of [
    { estado: 'RETIRADO', ubicacion_x: 10, ubicacion_y: 20 },
    { estado: 'EN_TRANSITO', ubicacion_x: 30, ubicacion_y: 35 },
    { estado: 'INCIDENCIA', motivo: 'Calle cerrada por obras (ficticio)' },
    { estado: 'EN_TRANSITO', observacion: 'Desvío por otra calle' },
  ]) {
    const r = await cambiar(codigo, { repartidor: rep, ...paso });
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
    assert.equal(r.cuerpo.datos.estado, paso.estado);
  }
  const datos = await seguimientoAlDia(codigo);
  const eventos = datos.historial.eventos;
  assert.deepEqual(eventos.map((e) => e.tipo),
    ['CREADO', 'ACEPTADO', 'ASIGNADO', 'RETIRADO', 'EN_TRANSITO', 'INCIDENCIA', 'EN_TRANSITO']);
  const secuencias = eventos.map((e) => e.secuencia);
  assert.deepEqual(secuencias, [...secuencias].sort((a, b) => a - b), 'orden por secuencia');
  assert.deepEqual(eventos.slice(3).map((e) => e.actor), [rep, rep, rep, rep], 'autor = repartidor');
  assert.equal(eventos[5].datos.motivo, 'Calle cerrada por obras (ficticio)');
  assert.deepEqual(eventos[3].datos.ubicacion, { x: 10, y: 20, sistema: 'PLANO_FICTICIO_0_100' });
});

test('transición inválida ASIGNADO → EN_TRANSITO responde 409 y no registra evento', async () => {
  const { codigo, rep } = await envioAsignado();
  const antes = (await pedir('/health')).cuerpo.datos.outbox.total;
  const r = await cambiar(codigo, { repartidor: rep, estado: 'EN_TRANSITO' });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.error.codigo, 'TRANSICION_INVALIDA');
  assert.equal((await pedir('/health')).cuerpo.datos.outbox.total, antes);
});

test('ASIGNADO → ENTREGADO se rechaza: la entrega exige evidencia (409)', async () => {
  const { codigo, rep } = await envioAsignado();
  const directo = await cambiar(codigo, { repartidor: rep, estado: 'ENTREGADO' });
  assert.equal(directo.status, 409);
  assert.equal(directo.cuerpo.error.codigo, 'REQUIERE_EVIDENCIA');
  const conEvidencia = await pedir('/api/evidencias', { metodo: 'POST', cuerpo: evidencia(codigo, rep) });
  assert.equal(conEvidencia.status, 409);
  assert.equal(conEvidencia.cuerpo.error.codigo, 'TRANSICION_INVALIDA');
});

test('otro repartidor no puede cambiar el envío (409 NO_ASIGNADO)', async () => {
  const { codigo, rep } = await envioAsignado();
  const otro = rep === 'REP-001' ? 'REP-002' : 'REP-001';
  const r = await cambiar(codigo, { repartidor: otro, estado: 'RETIRADO' });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.error.codigo, 'NO_ASIGNADO');
});

test('repetir el mismo cambio es idempotente: 200 y sin evento nuevo', async () => {
  const { codigo, rep } = await envioAsignado();
  assert.equal((await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' })).status, 201);
  const antes = (await pedir('/health')).cuerpo.datos.outbox.total;
  const repetido = await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  assert.equal(repetido.status, 200);
  assert.equal(repetido.cuerpo.datos.cambiado, false);
  assert.equal((await pedir('/health')).cuerpo.datos.outbox.total, antes);
});

test('validación: incidencia sin motivo y códigos mal formados → 400', async () => {
  const { codigo, rep } = await envioAsignado();
  await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  const sinMotivo = await cambiar(codigo, { repartidor: rep, estado: 'INCIDENCIA' });
  assert.equal(sinMotivo.status, 400);
  assert.equal(sinMotivo.cuerpo.error.detalles[0].campo, 'motivo');
  assert.equal((await pedir('/api/seguimiento/ENV-123')).status, 400);
  assert.equal((await pedir('/api/seguimiento/ENV-AAAAAAAA')).status, 404);
  assert.equal((await cambiar(codigo, { repartidor: 'R1', estado: 'EN_TRANSITO' })).status, 400);
});

test('incidencia → cancelado: exige motivo, guarda cancelado_en y libera la capacidad', async () => {
  const { codigo, rep } = await envioAsignado();
  const cargaInicial = await cargaDe(rep);
  await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  await cambiar(codigo, { repartidor: rep, estado: 'INCIDENCIA', motivo: 'Dirección inexistente (ficticio)' });
  const r = await cambiar(codigo, { repartidor: rep, estado: 'CANCELADO', motivo: 'Destinatario no ubicado' });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  assert.equal(await cargaDe(rep), cargaInicial - 1);
  const envio = (await pedir(`/api/envios/${codigo}`)).cuerpo.datos;
  assert.equal(envio.estado, 'CANCELADO');
  assert.ok(envio.fechas.cancelado_en);
  assert.equal(envio.motivo_cancelacion, 'Destinatario no ubicado');
});

test('tareas del repartidor: lista sus envíos en curso con las acciones permitidas', async () => {
  const { codigo, rep } = await envioAsignado();
  const r = await pedir(`/api/seguimiento/repartidores/${rep}/tareas`);
  assert.equal(r.status, 200);
  const tarea = r.cuerpo.datos.tareas.find((t) => t.codigo === codigo);
  assert.ok(tarea, 'el envío asignado aparece en las tareas');
  assert.deepEqual(tarea.acciones, ['RETIRADO']);
  assert.equal((await pedir('/api/seguimiento/repartidores/REP-1/tareas')).status, 400);
});

// ---------- Dominio 4: evidencias y entrega ----------

test('entrega con evidencia: 201, estado ENTREGADO, capacidad liberada y evidencia en el detalle', async () => {
  const { codigo, rep } = await envioAsignado();
  await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  await cambiar(codigo, { repartidor: rep, estado: 'EN_TRANSITO' });
  const carga = await cargaDe(rep);
  const cuerpo = evidencia(codigo, rep);
  const r = await pedir('/api/evidencias', { metodo: 'POST', cuerpo });
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.datos.envio.estado, 'ENTREGADO');
  assert.equal(r.cuerpo.datos.evidencia.confirmada, true);
  assert.equal(await cargaDe(rep), carga - 1, 'la entrega libera la capacidad');

  const datos = await seguimientoAlDia(codigo);
  assert.equal(datos.estado_vigente.estado, 'ENTREGADO');
  assert.equal(datos.envio.evidencia_id, cuerpo.clave_evidencia);
  assert.equal(datos.evidencia.clave_evidencia, cuerpo.clave_evidencia);
  assert.equal(datos.evidencia.receptor.nombre, 'Luis Inventado');
  assert.equal(datos.evidencia.foto.tipo, 'REFERENCIA');
  assert.equal(datos.historial.eventos.at(-1).tipo, 'ENTREGADO');
  assert.equal(datos.historial.coherente, true);

  const consulta = await pedir(`/api/evidencias/${cuerpo.clave_evidencia}`);
  assert.equal(consulta.status, 200);
  assert.equal(consulta.cuerpo.datos.codigo_envio, codigo);
});

test('reintento con la misma clave_evidencia no duplica la evidencia ni el evento', async () => {
  const { codigo, rep } = await envioAsignado();
  await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  await cambiar(codigo, { repartidor: rep, estado: 'EN_TRANSITO' });
  const cuerpo = evidencia(codigo, rep);
  const [a, b] = await Promise.all([
    pedir('/api/evidencias', { metodo: 'POST', cuerpo }),
    pedir('/api/evidencias', { metodo: 'POST', cuerpo }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 201], `${JSON.stringify(a.cuerpo)} ${JSON.stringify(b.cuerpo)}`);
  const antes = (await pedir('/health')).cuerpo.datos.outbox.total;
  const c = await pedir('/api/evidencias', { metodo: 'POST', cuerpo });
  assert.equal(c.status, 200);
  assert.equal(c.cuerpo.datos.creada, false);
  assert.equal((await pedir('/health')).cuerpo.datos.outbox.total, antes);

  const lista = await pedir(`/api/evidencias?codigo_envio=${codigo}`);
  assert.equal(lista.cuerpo.datos.length, 1, 'una sola evidencia');
  const datos = await seguimientoAlDia(codigo);
  assert.equal(datos.historial.eventos.filter((e) => e.tipo === 'ENTREGADO').length, 1);

  // Otra evidencia para un envío ya entregado → 409
  const otra = await pedir('/api/evidencias', { metodo: 'POST', cuerpo: evidencia(codigo, rep) });
  assert.equal(otra.status, 409);
  assert.equal(otra.cuerpo.error.codigo, 'YA_ENTREGADO');
});

test('evidencia heterogénea: un tercero que recibe exige relación; URL simulada se acepta', async () => {
  const { codigo, rep } = await envioAsignado();
  await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  await cambiar(codigo, { repartidor: rep, estado: 'EN_TRANSITO' });
  const sinRelacion = await pedir('/api/evidencias', {
    metodo: 'POST', cuerpo: evidencia(codigo, rep, { receptor_tipo: 'PORTERIA', receptor_nombre: 'Conserje Ficticio' }),
  });
  assert.equal(sinRelacion.status, 400);
  assert.equal(sinRelacion.cuerpo.error.detalles[0].campo, 'receptor_relacion');
  const ok = await pedir('/api/evidencias', {
    metodo: 'POST',
    cuerpo: evidencia(codigo, rep, {
      receptor_tipo: 'PORTERIA', receptor_nombre: 'Conserje Ficticio', receptor_relacion: 'Conserje del edificio',
      foto_referencia: 'https://fotos.ejemplo.invalid/entregas/simulada-001.jpg',
    }),
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.cuerpo));
  assert.equal(ok.cuerpo.datos.evidencia.foto.tipo, 'URL');
  assert.equal(ok.cuerpo.datos.evidencia.receptor.relacion, 'Conserje del edificio');
});

test('evidencias huérfanas: el listado responde con el plazo de 10 minutos', async () => {
  const r = await pedir('/api/evidencias/huerfanas');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.datos.plazo_minutos, 10);
  assert.ok(Array.isArray(r.cuerpo.datos.huerfanas));
});

// ---------- Dominio 6: estado temporal (Redis) ----------

test('estado temporal: ubicación con TTL que corre, y "sin dato vigente" al marcarla no vigente', async () => {
  const rep = await repartidor();
  const guardado = await pedir(`/api/estado-temporal/repartidores/${rep}/ubicacion`, {
    metodo: 'PUT', cuerpo: { x: 12.3, y: 45.6 },
  });
  assert.equal(guardado.status, 200, JSON.stringify(guardado.cuerpo));
  const ubic = guardado.cuerpo.datos.ubicacion;
  assert.equal(ubic.vigente, true);
  assert.equal(ubic.x, 12.3);
  assert.ok(ubic.ttl_segundos > 0 && ubic.ttl_segundos <= 90, `TTL ${ubic.ttl_segundos}`);

  await esperar(2100);
  const despues = (await pedir(`/api/estado-temporal/repartidores/${rep}`)).cuerpo.datos.ubicacion;
  assert.ok(despues.ttl_segundos < ubic.ttl_segundos, 'el TTL disminuye: la clave expira sola');

  const conexion = await pedir(`/api/estado-temporal/repartidores/${rep}/conexion`, {
    metodo: 'PUT', cuerpo: { estado: 'EN_LINEA' },
  });
  assert.equal(conexion.cuerpo.datos.conexion.estado, 'EN_LINEA');

  const marcado = await pedir(`/api/estado-temporal/repartidores/${rep}/no-vigente`, { metodo: 'PATCH' });
  assert.equal(marcado.status, 200);
  const final = (await pedir(`/api/estado-temporal/repartidores/${rep}`)).cuerpo.datos;
  assert.equal(final.ubicacion.vigente, false);
  assert.equal(final.ubicacion.mensaje, 'Sin dato vigente');
  assert.equal(final.conexion.vigente, false);
});

test('estado temporal: valida el plano ficticio y el repartidor', async () => {
  const rep = await repartidor();
  const fuera = await pedir(`/api/estado-temporal/repartidores/${rep}/ubicacion`, { metodo: 'PUT', cuerpo: { x: 150, y: 10 } });
  assert.equal(fuera.status, 400);
  const noExiste = await pedir('/api/estado-temporal/repartidores/REP-000');
  assert.equal(noExiste.status, 404);
  const malo = await pedir(`/api/estado-temporal/repartidores/${rep}/conexion`, { metodo: 'PUT', cuerpo: { estado: 'VOLANDO' } });
  assert.equal(malo.status, 400);
});

test('la ubicación temporal no es prueba de entrega: el envío sigue EN_TRANSITO', async () => {
  const { codigo, rep } = await envioAsignado();
  await cambiar(codigo, { repartidor: rep, estado: 'RETIRADO' });
  await cambiar(codigo, { repartidor: rep, estado: 'EN_TRANSITO', ubicacion_x: 50, ubicacion_y: 50 });
  await pedir(`/api/estado-temporal/repartidores/${rep}/ubicacion`, { metodo: 'PUT', cuerpo: { x: 99, y: 99, codigo_envio: codigo } });
  const datos = (await pedir(`/api/seguimiento/${codigo}`)).cuerpo.datos;
  assert.equal(datos.estado_vigente.estado, 'EN_TRANSITO');
  assert.equal(datos.evidencia, null);
  assert.equal(datos.estado_temporal.ubicacion.vigente, true);
});
