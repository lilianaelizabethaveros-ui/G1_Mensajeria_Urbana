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
| `/api/despacho` | Despacho y asignaciones | Camila | Implementado y probado (Dominio 2) |
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

### Dominio 2 — Despacho y asignaciones

**Estado:** Implementado y probado.

**Responsable:** Camila Perrazo.

**Base de datos:** PostgreSQL.

**Archivos principales:**
- `backend/src/modules/despacho/despacho.repository.js`
- `backend/src/modules/despacho/despacho.service.js`
- `backend/src/modules/despacho/despacho.controller.js`
- `backend/src/modules/despacho/despacho.routes.js`
- `database/postgres/migrations/101_repartidores.sql`
- `database/postgres/migrations/190_semilla_repartidores.sql`

**Pantallas:**
- `/despacho/index.html` — Panel de despacho.
- `/despacho/admin.html` — Panel administrativo.

### Endpoints de despacho

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/despacho/pendientes` | Consultar envíos pendientes de asignación. |
| GET | `/api/despacho/repartidores` | Consultar repartidores, capacidades y carga actual. |
| POST | `/api/despacho/asignaciones` | Asignar un envío ACEPTADO a un repartidor disponible. |
| PATCH | `/api/despacho/asignaciones/:codigo/liberar` | Liberar la asignación activa de un envío y regresarlo a ACEPTADO. |
| PATCH | `/api/despacho/asignaciones/:codigo/reasignar` | Cambiar el repartidor asignado a un envío. |

### Ejemplo: asignar un envío

**POST** `/api/despacho/asignaciones`

Cuerpo JSON:

```json
{
  "codigo_envio": "ENV-XXXXXXXX",
  "codigo_repartidor": "REP-001"
}
```

`ENV-XXXXXXXX` representa un código de envío existente en estado ACEPTADO.

**Resultados principales:**
- `201`: asignación creada correctamente.
- `200`: asignación repetida al mismo repartidor; operación idempotente.
- `400`: datos de entrada inválidos.
- `409`: conflicto de estado o capacidad agotada.

La asignación comprueba que el envío esté en estado ACEPTADO,
que el repartidor esté disponible y que exista capacidad suficiente.

### Concurrencia e integridad

Las operaciones de asignación emplean transacciones de PostgreSQL.

Se bloquean los registros correspondientes mediante
`SELECT ... FOR UPDATE` para evitar asignaciones incompatibles.

Se verifica la carga actual antes de ocupar un cupo.

La tabla `asignaciones` utiliza un índice único parcial
sobre el código del envío cuando `liberada_en IS NULL`.
Esto impide más de una asignación activa por envío.

Los cambios de estado y los eventos de la outbox se registran
dentro de la misma transacción.

La reasignación libera la asignación anterior y registra
la nueva asignación, conservando el historial.

### Idempotencia D33

Cuando se solicita nuevamente la asignación de un envío
al mismo repartidor que ya lo tiene asignado:

- Se responde HTTP 200.
- No se crea una segunda asignación activa.
- No se genera un segundo evento de asignación.

### Endpoints administrativos

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/despacho/admin/zonas` | Listar zonas registradas. |
| POST | `/api/despacho/admin/zonas` | Crear una zona. |
| PATCH | `/api/despacho/admin/zonas/:codigo` | Modificar el nombre y estado de una zona. |
| POST | `/api/despacho/admin/repartidores` | Registrar un repartidor. |
| PATCH | `/api/despacho/admin/repartidores/:codigo` | Actualizar nombre, zona, capacidad y estado del repartidor. |

### Ejemplo: registrar un repartidor

**POST** `/api/despacho/admin/repartidores`

```json
{
  "codigo": "REP-008",
  "nombre": "Repartidor de Ejemplo",
  "zona": "NORTE",
  "capacidad_maxima": 2
}
```

La API valida el código, nombre, zona activa y capacidad positiva.

### Capacidad operativa

El sistema consulta la cantidad de asignaciones activas
de cada repartidor y calcula sus cupos disponibles.

Al actualizar la capacidad máxima, se comprueba que
el nuevo valor no sea inferior a la carga actual.

El panel administrativo permite activar o desactivar
repartidores y zonas, además de actualizar sus datos.

### Pruebas automatizadas

**Archivo:** `tests/despacho.test.js`

**Ejecutar desde la raíz del proyecto:**

```bash
node --test tests/despacho.test.js
```

**Resultado verificado:** 10 pruebas aprobadas, 0 fallidas.

Las pruebas comprueban:
- Asignación válida.
- Idempotencia D33.
- Rechazo por capacidad agotada (HTTP 409).
- Asignaciones simultáneas al último cupo.
- Reasignación.
- Liberación de capacidad.
- Consulta de carga operativa.
- Disponibilidad de las pantallas del Dominio 2.

Las pruebas generan información ficticia en la base
de datos local y no eliminan automáticamente sus registros.

### Integración pendiente con otros dominios

Se debe coordinar con el responsable de seguimiento
la liberación de capacidad al registrar una entrega.

La consulta operativa del Dominio 5 se documentará
cuando sus endpoints y filtros estén implementados.

### Dominio 5 — Consulta operativa


**Estado:** Implementado y probado.

**Responsable:** Camila Perrazo.

**Gestor:** PostgreSQL.

**Endpoint:** `GET /api/consulta`

**Pantalla:** `/despacho/consulta.html`

### Filtros disponibles

| Parámetro | Descripción |
| --- | --- |
| `codigo` | Código completo o parcial del envío. |
| `zona` | Código de zona de destino. |
| `estado` | Estado actual del envío. |
| `destinatario` | Nombre completo o parcial del destinatario. |
| `fecha_desde` | Fecha inicial del registro, incluida. |
| `fecha_hasta` | Fecha final del registro, incluida. |
| `pagina` | Número de página, desde 1. |
| `limite` | Resultados por página, de 1 a 100. |

Los filtros son opcionales y pueden combinarse.

### Ejemplo de consulta

`GET /api/consulta?zona=CENTRO&estado=ACEPTADO`

La respuesta utiliza el formato común `{ ok, datos }`.

Dentro de `datos` se incluyen:
- `resultados`: lista de envíos encontrados.
- `paginacion`: página actual, límite, total y total de páginas.

### Validaciones

- `200`: consulta realizada correctamente, incluso sin coincidencias.
- `400 VALIDACION`: filtros, fechas o paginación inválidos.
- `500 ERROR_INTERNO`: error inesperado del servidor.

### Decisión P2 — Índices PostgreSQL

Se eligieron índices sobre la tabla `envios` en lugar de una vista derivada.

Migración: `102_indices_consulta.sql`.

La consulta lee directamente el estado vigente desde PostgreSQL.
No requiere mantener ni sincronizar una copia adicional de los datos.

### Archivos implementados

- `backend/src/modules/consulta/consulta.repository.js`
- `backend/src/modules/consulta/consulta.service.js`
- `backend/src/modules/consulta/consulta.controller.js`
- `backend/src/modules/consulta/consulta.routes.js`
- `database/postgres/migrations/102_indices_consulta.sql`
- `frontend/despacho/consulta.html`
- `frontend/despacho/consulta.js`
- `tests/consulta.test.js`

### Pruebas realizadas

**Comando:** `node --test tests/consulta.test.js`

**Resultado:** 18 pruebas aprobadas, 0 fallidas.

Se verificaron búsquedas por código, zona, estado, destinatario,
fechas, filtros combinados, validaciones y paginación.

**Pruebas generales del proyecto:** 63 aprobadas, 0 fallidas.

La interfaz también se comprobó en Chrome, obteniendo
12 envíos con la combinación zona CENTRO y estado ACEPTADO.


## Juan Fernando — Seguimiento, evidencias y estado temporal

*Pendiente.*
