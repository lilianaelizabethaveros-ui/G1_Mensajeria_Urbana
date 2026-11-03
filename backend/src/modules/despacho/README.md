# Módulo `despacho` — Despacho y asignaciones

- **Responsable:** Camila
- **Dominio del enunciado:** Dominio 2
- **Prefijo de URL:** `/api/despacho`
- **Gestor principal:** PostgreSQL

Repartidores (`REP-NNN`), capacidad, asignación, reasignación y liberación. La capacidad se controla con transacción y bloqueo de fila en PostgreSQL. **Pendiente: lo desarrolla Camila.** Sus migraciones usan el rango 100-199.

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `despacho.routes.js` → `despacho.controller.js` (HTTP) → `despacho.service.js` (reglas) → `despacho.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `despacho.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `despacho.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
