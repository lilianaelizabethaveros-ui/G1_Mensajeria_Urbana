# Módulo `catalogos` — Zonas y tipos de servicio

- **Responsable:** Liliana (lectura); Camila agrega el CRUD administrativo
- **Dominio del enunciado:** Apoyo a los Dominios 1 y 2
- **Prefijo de URL:** `/api/catalogos`
- **Gestor principal:** PostgreSQL

Lectura de zonas y tipos de servicio con datos semilla, necesarios para validar el formulario de solicitud.

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `catalogos.routes.js` → `catalogos.controller.js` (HTTP) → `catalogos.service.js` (reglas) → `catalogos.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `catalogos.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `catalogos.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
