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
- **Estado actual (Fase 5):** implementada la lectura `GET /api/catalogos` (`catalogos.routes.js` →
  `catalogos.repository.js`; al ser solo lectura no necesita controlador ni servicio propios). El módulo `envios`
  usa `buscarZonaActiva` y `buscarTipoServicioActivo` para validar solicitudes. El CRUD administrativo
  lo agrega Camila acordándolo antes, porque cambia este módulo.
- **Contratos disponibles:** `shared/estados.js` (validarTransicion), `shared/validacion.js` (validar),
  `shared/errores.js` (AppError, errores), `shared/identificadores.js`, `shared/outbox.js` (registrarEvento)
  y `db/postgres.js` (pool, conTransaccion).
