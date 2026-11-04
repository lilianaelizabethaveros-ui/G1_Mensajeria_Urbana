# Redis

Contenido: **Dominio 6, estado temporal** (responsable: Liliana Averos, ver D38).

Redis guarda solo datos efímeros con expiración (TTL). No es fuente oficial de nada
duradero y nunca cuenta como prueba de entrega.

## Convención de claves

| Clave | Valor | TTL |
| --- | --- | --- |
| `repartidor:REP-001:ubicacion` | JSON con `x`, `y` en un plano ficticio 0–100 y la hora | 90 s (D39) |
| `repartidor:REP-001:conexion` | JSON con `EN_LINEA` / `OCUPADO` / `EN_PAUSA` y la hora | 90 s (D39) |

## Persistencia (D40)

Redis corre con `--save ""` y `--appendonly no`: no escribe en disco. Al reiniciarse arranca vacío y la
web muestra "Sin dato vigente" sin afectar envíos, asignaciones, evidencias ni historial.

Comprobar dentro del contenedor:

```powershell
docker compose exec redis redis-cli CONFIG GET save        # debe mostrar un valor vacío
docker compose exec redis redis-cli KEYS "repartidor:*"
docker compose exec redis redis-cli TTL repartidor:REP-003:ubicacion
```

Si el volumen `mensajeria_redis_data` tiene un `dump.rdb` de antes de D40, Redis lo carga al arrancar
(por ejemplo una clave de prueba sin TTL). No afecta al sistema; las claves del Dominio 6 siempre llevan TTL.
