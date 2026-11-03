# Módulo `envios` — Solicitudes y envíos

- **Responsable:** Liliana
- **Dominio del enunciado:** Dominio 1
- **Prefijo de URL:** `/api/envios`
- **Gestor principal:** PostgreSQL

Registrar solicitudes, generar el código único `ENV-XXXXXXXX`, consultar por código, aceptar y cancelar según la máquina de estados. Cada cambio de estado escribe su evento en la outbox en la misma transacción. Se implementa en la Fase 5.

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `envios.routes.js` → `envios.controller.js` (HTTP) → `envios.service.js` (reglas) → `envios.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `envios.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `envios.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
