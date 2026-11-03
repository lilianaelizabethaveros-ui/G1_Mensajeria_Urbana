# API REST

Base: `http://localhost:3000`. Formato JSON (`Content-Type: application/json`, máximo 100 KB).
Cada integrante documenta sus endpoints **solo en su sección** para evitar conflictos de Git.

## Formato común de respuestas (implementado en la Fase 4)

Éxito:

```json
{ "ok": true, "datos": { } }
```

Error (lo genera `middleware/errorHandler.js`):

```json
{ "ok": false, "error": { "codigo": "VALIDACION", "mensaje": "Los datos enviados no son válidos.", "detalles": [ { "campo": "peso_kg", "mensaje": "peso_kg debe ser un número." } ] } }
```

| HTTP | `codigo` | Cuándo | ¿Reintentar? |
| --- | --- | --- | --- |
| 200 | — | Consulta, o reintento idempotente exitoso | — |
| 201 | — | Recurso creado | — |
| 400 | `VALIDACION` | Datos inválidos; `detalles` trae un error por campo | No, corregir datos |
| 400 | `JSON_INVALIDO` | El cuerpo no es JSON válido | No, corregir |
| 404 | `NO_ENCONTRADO` | Recurso o ruta `/api` inexistente | No |
| 409 | `TRANSICION_INVALIDA` | Cambio de estado no permitido por la máquina de estados | No |
| 409 | `DUPLICADO` | Violación de unicidad en PostgreSQL | No |
| 409 | otros (por módulo) | Conflictos de negocio, p. ej. capacidad | No |
| 413 | `CUERPO_DEMASIADO_GRANDE` | Cuerpo mayor a 100 KB | No |
| 500 | `ERROR_INTERNO` | Error inesperado (el detalle solo queda en los logs) | Sí, con cuidado |
| 501 | `NO_IMPLEMENTADO` | Módulo registrado pero aún no desarrollado | No |
| 503 | `SERVICIO_NO_DISPONIBLE` | Un gestor no responde | Sí, en unos segundos |

## Compartido — Salud

### `GET /health`

Comprueba API, PostgreSQL, MongoDB y Redis (límite de 2 s por gestor), sin exponer credenciales.

- `200` si los tres gestores responden; `503` si alguno falla (la API sigue atendiendo).

```json
{
  "ok": true,
  "datos": {
    "api": "ok",
    "gestores": {
      "postgres": { "estado": "ok", "ms": 3 },
      "mongo":    { "estado": "ok", "ms": 2 },
      "redis":    { "estado": "caido", "ms": 1, "error": "sin conexión" }
    },
    "outbox": { "pendientes": 0, "total": 0, "antiguedad_segundos": null },
    "migraciones": { "aplicadas": 2, "ultima": 90 },
    "fecha": "2026-11-03T16:50:06.295Z"
  }
}
```

`outbox.pendientes` = eventos aún no copiados a MongoDB (ver `docs/consistencia.md`).
`outbox` y `migraciones` son `null` si PostgreSQL no responde.

## Prefijos registrados

| Prefijo | Módulo | Responsable | Estado actual |
| --- | --- | --- | --- |
| `/api/catalogos` | Zonas y tipos de servicio | Liliana | Implementado (Fase 5) |
| `/api/envios` | Solicitudes y envíos | Liliana | Implementado (Fase 5) |
| `/api/despacho` | Despacho y asignaciones | Camila | `501` pendiente |
| `/api/consulta` | Consulta operativa | Camila | `501` pendiente |
| `/api/seguimiento` | Seguimiento y eventos | Juan Fernando | `501` pendiente |
| `/api/evidencias` | Evidencias de entrega | Juan Fernando | `501` pendiente |
| `/api/estado-temporal` | Estado temporal | Juan Fernando | `501` pendiente |

## Liliana — Catálogos y envíos

Implementado en la Fase 5. Pantallas: `/envios/solicitud.html`, `/envios/confirmacion.html?codigo=…`
y `/envios/consulta.html?codigo=…`. Pruebas: `tests/envios.test.js`.

### `GET /api/catalogos`

Zonas y tipos de servicio **activos** (sin ids internos). Lo usa el formulario para llenar sus opciones.

```json
{ "ok": true, "datos": {
  "zonas": [ { "codigo": "NORTE", "nombre": "Zona Norte" } ],
  "tipos_servicio": [ { "codigo": "EXPRESS", "nombre": "Express", "descripcion": "…", "tiempo_estimado_horas": 4, "peso_maximo_kg": 10 } ]
} }
```

### `POST /api/envios` — registrar una solicitud

Encabezado opcional `Idempotency-Key: <UUID>`. El formulario genera uno por solicitud con `crypto.randomUUID()`;
si la petición se repite con la misma clave (doble clic, red lenta) se devuelve el envío ya creado y **no** se crea
otro ni se registra otro evento.

| Campo | Tipo | Regla |
| --- | --- | --- |
| `remitente_nombre`, `destinatario_nombre` | texto | 3–80, solo letras, espacios, `.`, `'`, `-` |
| `remitente_telefono`, `destinatario_telefono` | texto | `^0\d{8,9}$` (ficticio) |
| `origen_direccion`, `destino_direccion` | texto | 5–160 |
| `origen_zona`, `destino_zona` | texto | Código de zona activa (acepta minúsculas) |
| `tipo_servicio` | texto | Código de tipo activo (acepta minúsculas) |
| `descripcion` | texto | 3–160 |
| `peso_kg` | número | > 0 y no mayor al `peso_maximo_kg` del tipo elegido |
| `observaciones` | texto | Opcional, hasta 300 |

Otros campos (`estado`, `codigo`, `precio`…) se **ignoran**: el estado inicial siempre es `CREADO` y el código lo
genera el servidor. Origen y destino no pueden ser la misma dirección en la misma zona.

| Respuesta | Cuándo |
| --- | --- |
| `201` + `Location: /api/envios/ENV-…` | Envío creado; en la misma transacción se escribe el evento `CREADO` en la outbox |
| `200` + `"repetido": true` | La `Idempotency-Key` ya había creado un envío: se devuelve ese mismo |
| `400 VALIDACION` | Datos inválidos o clave que no es UUID; `detalles` trae `{campo, mensaje}` por cada error |

Contrato del envío (lo devuelven todos los endpoints de este módulo):

```json
{
  "codigo": "ENV-7K2M9XQ4",
  "estado": "CREADO",
  "tipo_servicio": { "codigo": "EXPRESS", "nombre": "Express", "tiempo_estimado_horas": 4 },
  "remitente": { "nombre": "Ana Ficticia", "telefono": "0990000001" },
  "origen": { "direccion": "Calle Ficticia 123", "zona": { "codigo": "NORTE", "nombre": "Zona Norte" } },
  "destinatario": { "nombre": "Luis Inventado", "telefono": "0990000002" },
  "destino": { "direccion": "Pasaje Ejemplo 45", "zona": { "codigo": "SUR", "nombre": "Zona Sur" } },
  "paquete": { "descripcion": "Documentos", "peso_kg": 1.5 },
  "observaciones": "",
  "entrega_estimada": "2026-11-03T21:21:00.000Z",
  "motivo_cancelacion": null,
  "fechas": { "creado_en": "…", "actualizado_en": "…", "aceptado_en": null, "cancelado_en": null },
  "transiciones_permitidas": ["ACEPTADO", "CANCELADO"]
}
```

`entrega_estimada` = `creado_en` + horas del tipo de servicio (`null` si está cancelado).
`transiciones_permitidas` sale de `shared/estados.js` (propuesta P1).

### `GET /api/envios/:codigo`

Devuelve el contrato del envío leído de PostgreSQL (fuente oficial del estado vigente). Acepta el código en
minúsculas. `400 VALIDACION` si el formato no es `ENV-XXXXXXXX`; `404 NO_ENCONTRADO` si no existe.

### `PATCH /api/envios/:codigo/aceptar`

El operador acepta la solicitud: `CREADO → ACEPTADO`. Sin cuerpo. Responde `{ ok, datos, cambiado }`.

- Si ya estaba `ACEPTADO`: `200` con `cambiado: false` y **sin** evento nuevo (idempotente).
- Desde cualquier otro estado: `409 TRANSICION_INVALIDA`.

### `PATCH /api/envios/:codigo/cancelar`

Cuerpo: `{ "motivo": "texto de 5 a 200", "actor": "CLIENTE" | "OPERADOR" }` (`actor` por defecto `CLIENTE`).
Solo desde `CREADO` o `ACEPTADO` → `CANCELADO`; guarda `motivo_cancelacion` y `cancelado_en`.

- Si ya estaba `CANCELADO`: `200` con `cambiado: false` y sin evento nuevo.
- Desde `ASIGNADO` en adelante: `409 TRANSICION_INVALIDA` (quién cancela un envío asignado es la propuesta P3).
- Sin motivo: `400 VALIDACION`.

### Eventos que escribe este módulo en la outbox

| `tipo` | `actor` | `datos` |
| --- | --- | --- |
| `CREADO` | `CLIENTE` | `{ tipo_servicio, origen_zona, destino_zona }` |
| `ACEPTADO` | `OPERADOR` | `{ estado_anterior }` |
| `CANCELADO` | `CLIENTE` u `OPERADOR` | `{ estado_anterior, motivo }` |

Cada cambio bloquea la fila del envío (`SELECT … FOR UPDATE`), cambia el estado y escribe el evento en **una sola
transacción**: si algo falla no queda ni el cambio ni el evento. Juan Fernando copia estos eventos a MongoDB.

### Notas para Camila y Juan Fernando

- Tabla `envios` (migración `002_envios.sql`): leer por `codigo`; el estado vigente está en `envios.estado`.
- Para cambiar el estado desde sus módulos, usen el mismo patrón: `conTransaccion` + `SELECT … FOR UPDATE`
  + `validarTransicion` + `registrarEvento`. No escriban en `envios` columnas que no sean de su dominio sin acordarlo.
- Índice disponible para listados por estado: `envios (estado, creado_en)`.

## Camila — Despacho y consulta

*Pendiente.*

## Juan Fernando — Seguimiento, evidencias y estado temporal

*Pendiente.*
