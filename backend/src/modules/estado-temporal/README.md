# Módulo `estado-temporal` — Estado temporal de repartidores

- **Responsable:** Liliana Averos (asignado al inicio a Juan Fernando Jaramillo; ver D38 en la bitácora)
- **Dominio del enunciado:** Dominio 6
- **Prefijo de URL:** `/api/estado-temporal`
- **Gestor principal:** Redis (claves con TTL de 90 s, sin persistencia en disco)

| Clave | Valor (JSON) | TTL |
| --- | --- | --- |
| `repartidor:REP-NNN:ubicacion` | `{ x, y, sistema: "PLANO_FICTICIO_0_100", codigo_envio?, registrada_en }` | 90 s (D39) |
| `repartidor:REP-NNN:conexion` | `{ estado: EN_LINEA \| OCUPADO \| EN_PAUSA, actualizado_en }` | 90 s (D39) |

- Actualizar: `PUT …/ubicacion` y `PUT …/conexion`. Consultar: `GET …/repartidores` y `GET …/repartidores/:codigo`.
  Marcar no vigente: `PATCH …/:codigo/no-vigente`.
- Si Redis está caído, solo este módulo responde `503`. Un dato expirado se informa como "Sin dato vigente".
- La ubicación es un punto en un plano ficticio de 0 a 100 (D42) y nunca es prueba de entrega.
