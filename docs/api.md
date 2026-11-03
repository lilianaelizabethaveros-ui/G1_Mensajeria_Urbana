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
| `/api/catalogos` | Zonas y tipos de servicio | Liliana | `501` hasta la Fase 5 |
| `/api/envios` | Solicitudes y envíos | Liliana | `501` hasta la Fase 5 |
| `/api/despacho` | Despacho y asignaciones | Camila | `501` pendiente |
| `/api/consulta` | Consulta operativa | Camila | `501` pendiente |
| `/api/seguimiento` | Seguimiento y eventos | Juan Fernando | `501` pendiente |
| `/api/evidencias` | Evidencias de entrega | Juan Fernando | `501` pendiente |
| `/api/estado-temporal` | Estado temporal | Juan Fernando | `501` pendiente |

## Liliana — Catálogos y envíos

*Se define en la Fase 5.*

## Camila — Despacho y consulta

*Pendiente.*

## Juan Fernando — Seguimiento, evidencias y estado temporal

*Pendiente.*
