# Módulo `estado-temporal` — Estado temporal de repartidores

- **Responsable:** Juan Fernando
- **Dominio del enunciado:** Dominio 6
- **Prefijo de URL:** `/api/estado-temporal`
- **Gestor principal:** Redis (claves con TTL)

Última posición simulada y estado de conexión del repartidor, con expiración. Nunca se usa como prueba de entrega. **Pendiente: lo desarrolla Juan Fernando.**

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `estado-temporal.routes.js` → `estado-temporal.controller.js` (HTTP) → `estado-temporal.service.js` (reglas) → `estado-temporal.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `estado-temporal.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `estado-temporal.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
