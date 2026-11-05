# Módulo `seguimiento` — Seguimiento y eventos

- **Responsable:** Liliana Averos 
- **Dominio del enunciado:** Dominio 3
- **Prefijo de URL:** `/api/seguimiento`
- **Gestores:** MongoDB (colección `eventos`) para el historial; PostgreSQL para el estado vigente

| Archivo | Qué hace |
| --- | --- |
| `seguimiento.routes.js` | Rutas: línea de tiempo, cambios del repartidor, tareas y estado del sincronizador |
| `seguimiento.controller.js` | HTTP: códigos `200`/`201` |
| `seguimiento.service.js` | Reglas: regla de oro del cambio de estado, idempotencia, armado de la línea de tiempo |
| `seguimiento.repository.js` | SQL (envíos, asignaciones, outbox) y consultas a MongoDB `eventos` |
| `seguimiento.sincronizador.js` | Copia outbox → MongoDB cada 2 s (D44). Lo arranca `server.js` |

Reglas:

- El estado vigente siempre sale de PostgreSQL; el historial, de MongoDB. Si MongoDB no responde, la
  línea de tiempo lo avisa y el estado vigente se muestra igual.
- Solo el repartidor de la asignación activa puede cambiar el envío. ENTREGADO no se registra aquí:
  exige evidencia (`/api/evidencias`).
- Índice en MongoDB: `{ codigo_envio: 1, secuencia: 1 }` (único) y `{ actor: 1, ocurrido_en: -1 }`, creados al arrancar.

Endpoints y ejemplos: [docs/api.md](../../../../docs/api.md). Consistencia: [docs/consistencia.md](../../../../docs/consistencia.md).
