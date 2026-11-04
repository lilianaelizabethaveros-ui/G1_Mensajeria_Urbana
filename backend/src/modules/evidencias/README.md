# Módulo `evidencias` — Evidencias de entrega

- **Responsable:** Liliana Averos (asignado al inicio a Juan Fernando Jaramillo; ver D38 en la bitácora)
- **Dominio del enunciado:** Dominio 4
- **Prefijo de URL:** `/api/evidencias`
- **Gestor principal:** MongoDB (colección `evidencias`, con validador `$jsonSchema`)

Orden de escritura (D15, docs/consistencia.md §2): comprobar en PostgreSQL → guardar la evidencia en MongoDB con
`_id = clave_evidencia` → confirmar ENTREGADO en una transacción de PostgreSQL (estado, `evidencia_id`,
`entregado_en`, liberar la asignación y evento en la outbox). Un reintento con la misma clave no duplica nada.

| Archivo | Qué hace |
| --- | --- |
| `evidencias.routes.js` | `POST /`, `GET /?codigo_envio=`, `GET /huerfanas`, `GET /:clave` |
| `evidencias.controller.js` | HTTP: `201` entrega nueva, `200` reintento |
| `evidencias.service.js` | Validación de datos heterogéneos, orden MongoDB → PostgreSQL, huérfanas (10 min, D41) |
| `evidencias.repository.js` | MongoDB `evidencias` (validador e índices) y SQL de confirmación |

Una evidencia es prueba de entrega solo si `envios.evidencia_id` la referencia. Las evidencias nunca se borran.
