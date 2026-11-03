# Arquitectura

Monolito modular (decisión D4): una sola API Express con un módulo por dominio.
La API también sirve la web estática (D5).

```
Usuario
  │
  ▼
Navegador (HTML/CSS/JS)  ──  http://localhost:3000
  │  fetch /api/...
  ▼
API REST · Express (contenedor api)
  ├── /health
  ├── /api/catalogos        → PostgreSQL
  ├── /api/envios           → PostgreSQL (+ outbox)
  ├── /api/despacho         → PostgreSQL
  ├── /api/consulta         → PostgreSQL (índices)
  ├── /api/seguimiento      → MongoDB  (sincronizador outbox → eventos)
  ├── /api/evidencias       → MongoDB  (+ confirmación en PostgreSQL)
  └── /api/estado-temporal  → Redis (TTL)
  │
  ▼  red interna Docker (Fase 3)
PostgreSQL · MongoDB · Redis   (volúmenes persistentes, puertos solo en 127.0.0.1)
```

## Capas dentro de cada módulo

`routes` → `controller` (HTTP, códigos de estado) → `service` (reglas de negocio) →
`repository` (consultas al gestor). Las conexiones viven en `src/db/` y se comparten.

## Sincronización entre gestores

No hay transacción ACID conjunta entre gestores. Se usa la secuencia exigida por el
enunciado: escritura en la fuente oficial → captura del cambio (outbox) → actualización
de la proyección (MongoDB) → consulta. Detalle en [consistencia.md](consistencia.md).

*El diagrama gráfico para el informe se elaborará cuando la arquitectura esté verificada.*
