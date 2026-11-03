# Módulo `consulta` — Consulta operativa

- **Responsable:** Camila
- **Dominio del enunciado:** Dominio 5
- **Prefijo de URL:** `/api/consulta`
- **Gestor principal:** PostgreSQL con índices (vista derivada: propuesta P2)

Búsqueda de envíos por código, zona, estado, destinatario ficticio y fecha. **Pendiente: lo desarrolla Camila.**

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `consulta.routes.js` → `consulta.controller.js` (HTTP) → `consulta.service.js` (reglas) → `consulta.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
- **Estado actual:** `consulta.routes.js` ya está registrado en `routes/index.js` y responde `501`.
  Para implementar el módulo se reemplaza el contenido de `consulta.routes.js` por un `Router` propio.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
