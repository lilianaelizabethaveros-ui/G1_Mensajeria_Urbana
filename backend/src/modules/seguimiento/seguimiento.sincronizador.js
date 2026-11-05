// Sincronizador outbox (PostgreSQL) → eventos (MongoDB). Diseño en docs/consistencia.md §1.
// Responsable: Liliana Averos 
//
// Cada vuelta, dentro de UNA transacción de PostgreSQL:
//   1. Toma hasta 50 eventos pendientes en orden (FOR UPDATE SKIP LOCKED: si hubiera dos
//      procesos de la API, nunca toman el mismo evento).
//   2. Los copia a MongoDB con _id = id del evento. Se usa upsert + $setOnInsert: si el
//      documento ya existe (la API se cayó antes de marcarlo), no se duplica ni se modifica.
//   3. Marca procesado_en. Si MongoDB falla, suma intentos y guarda ultimo_error; el
//      evento sigue pendiente y se reintenta en la siguiente vuelta.
// PostgreSQL sigue siendo la fuente oficial: si se pierde la colección "eventos", basta con
// UPDATE outbox SET procesado_en = NULL; y el sincronizador la vuelve a llenar.
const { conTransaccion } = require('../../db/postgres');
const repositorio = require('./seguimiento.repository');
const evidencias = require('../evidencias/evidencias.repository');

const LOTE = 50;
const ESPERA_NORMAL_MS = 2000;      // entre vueltas cuando todo va bien
const ESPERA_MAXIMA_MS = 30000;     // tope de espera cuando MongoDB está caído

const estado = {
  activo: false,
  vueltas: 0,
  copiados: 0,
  ultima_vuelta: null,
  ultimo_exito: null,
  ultimo_error: null,
  fallos_seguidos: 0,
  indices_listos: false,
};

let temporizador = null;
let detenido = false;

async function asegurarIndices() {
  if (estado.indices_listos) return;
  await repositorio.asegurarIndices();
  await evidencias.asegurarColeccion();
  estado.indices_listos = true;
  console.log('[sincronizador] índices de MongoDB listos');
}

function aDocumento(fila) {
  return {
    _id: fila.id,
    secuencia: Number(fila.secuencia),
    codigo_envio: fila.codigo_envio,
    tipo: fila.tipo,
    actor: fila.actor,
    datos: fila.datos,
    ocurrido_en: fila.ocurrido_en,
    sincronizado_en: new Date(),
  };
}

/** Una vuelta del sincronizador. Devuelve cuántos eventos quedaron copiados. */
async function sincronizarUnaVez() {
  // Si MongoDB está caído, los índices se reintentan en la siguiente vuelta y el fallo
  // queda anotado en la outbox por el bulkWrite de abajo.
  await asegurarIndices().catch(() => {});

  const resultado = await conTransaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `SELECT id, secuencia, codigo_envio, tipo, actor, datos, ocurrido_en
         FROM outbox
        WHERE procesado_en IS NULL
        ORDER BY secuencia
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [LOTE],
    );
    if (rows.length === 0) return { copiados: 0 };
    const ids = rows.map((f) => f.id);

    try {
      await repositorio.eventos.bulkWrite(
        rows.map((fila) => {
          const { _id, ...resto } = aDocumento(fila);
          return { updateOne: { filter: { _id }, update: { $setOnInsert: resto }, upsert: true } };
        }),
        { ordered: true },
      );
    } catch (error) {
      // MongoDB no respondió: los eventos siguen pendientes y se anota el fallo en la outbox.
      await cliente.query(
        'UPDATE outbox SET intentos = intentos + 1, ultimo_error = $2 WHERE id = ANY($1::uuid[])',
        [ids, String(error.message).slice(0, 500)],
      );
      return { copiados: 0, fallo: error };
    }

    await cliente.query('UPDATE outbox SET procesado_en = now() WHERE id = ANY($1::uuid[])', [ids]);
    return { copiados: rows.length };
  });

  if (resultado.fallo) throw resultado.fallo;
  return resultado.copiados;
}

async function vuelta() {
  if (detenido) return;
  estado.vueltas += 1;
  estado.ultima_vuelta = new Date();
  let espera = ESPERA_NORMAL_MS;
  try {
    let copiados;
    // Si hay muchos pendientes (por ejemplo, tras una caída de MongoDB), se vacían lote a lote.
    do {
      copiados = await sincronizarUnaVez();
      estado.copiados += copiados;
    } while (copiados === LOTE && !detenido);
    if (estado.fallos_seguidos > 0) console.log('[sincronizador] MongoDB disponible otra vez: pendientes al día');
    estado.fallos_seguidos = 0;
    estado.ultimo_exito = new Date();
    estado.ultimo_error = null;
  } catch (error) {
    estado.fallos_seguidos += 1;
    estado.ultimo_error = error.message;
    if (estado.fallos_seguidos === 1) console.error('[sincronizador] no se pudo copiar a MongoDB:', error.message);
    // Espera creciente: 2 s, 4 s, 8 s… hasta 30 s, para no saturar los registros.
    espera = Math.min(ESPERA_NORMAL_MS * 2 ** estado.fallos_seguidos, ESPERA_MAXIMA_MS);
  }
  if (!detenido) temporizador = setTimeout(vuelta, espera);
}

function iniciar() {
  if (estado.activo) return;
  detenido = false;
  estado.activo = true;
  console.log(`[sincronizador] outbox → MongoDB activo (lotes de ${LOTE}, cada ${ESPERA_NORMAL_MS / 1000} s)`);
  temporizador = setTimeout(vuelta, 500);
}

function detener() {
  detenido = true;
  estado.activo = false;
  if (temporizador) clearTimeout(temporizador);
}

function resumen() {
  return { ...estado };
}

module.exports = { iniciar, detener, resumen, sincronizarUnaVez };
