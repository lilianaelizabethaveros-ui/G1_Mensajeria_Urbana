# Módulo `health` — Salud de la API

- **Responsable:** Compartido (Liliana)
- **Dominio del enunciado:** Contrato mínimo: Salud
- **Prefijo de URL:** `/health`
- **Gestor principal:** PostgreSQL, MongoDB y Redis (solo verificación)

Responde si la API y cada gestor están disponibles, sin exponer credenciales. Incluye el número de eventos pendientes de la outbox y la antigüedad del más viejo (ver `docs/consistencia.md`). Se implementa en la Fase 4.

## Reglas para trabajar en este módulo

- Solo su responsable modifica esta carpeta.
- Estructura: `health.routes.js` → `health.controller.js` (HTTP) → `health.service.js` (reglas) → `health.repository.js` (consultas).
- Las conexiones se importan de `src/db/`; no se abren conexiones propias.
- Los estados y códigos se toman de `src/shared/`; no se duplican.
- Los endpoints se documentan en la sección del módulo en `docs/api.md`.
