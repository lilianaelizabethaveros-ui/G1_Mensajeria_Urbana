# Módulo `evidencias` — Evidencias de entrega

- **Responsable:** Juan Fernando
- **Dominio del enunciado:** Dominio 4
- **Prefijo de URL:** `/api/evidencias`
- **Gestor principal:** MongoDB (colección `evidencias`)

Registro y consulta de pruebas de entrega simuladas. Debe seguir el orden evidencia → ENTREGADO descrito en `docs/consistencia.md`. **Pendiente: lo desarrolla Juan Fernando.**

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `evidencias.routes.js` → `evidencias.controller.js` (HTTP) → `evidencias.service.js` (reglas) → `evidencias.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `evidencias.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `evidencias.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
