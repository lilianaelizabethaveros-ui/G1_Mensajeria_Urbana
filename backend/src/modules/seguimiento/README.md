# Módulo `seguimiento` — Seguimiento y eventos

- **Responsable:** Juan Fernando
- **Dominio del enunciado:** Dominio 3
- **Prefijo de URL:** `/api/seguimiento`
- **Gestor principal:** MongoDB (colección `eventos`)

Retiro, tránsito, incidencia y entrega; línea de tiempo por código. Incluye el sincronizador outbox → MongoDB descrito en `docs/consistencia.md`. **Pendiente: lo desarrolla Juan Fernando.**

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `seguimiento.routes.js` → `seguimiento.controller.js` (HTTP) → `seguimiento.service.js` (reglas) → `seguimiento.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `seguimiento.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `seguimiento.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
