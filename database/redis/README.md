# Redis

Responsable del contenido: **Juan Fernando** (Dominio 6, estado temporal).

Redis guarda solo datos efímeros con expiración (TTL). No es fuente oficial de nada
duradero y nunca cuenta como prueba de entrega.

## Convención de claves (propuesta)

| Clave | Valor | TTL |
| --- | --- | --- |
| `repartidor:REP-001:ubicacion` | Coordenadas ficticias y hora | Por definir (Juan) |
| `repartidor:REP-001:conexion` | `en_linea` / `ocupado` | Por definir (Juan) |

Si Redis se reinicia y pierde estos datos, la web debe mostrar "sin dato vigente"
sin afectar envíos, asignaciones ni historial.
