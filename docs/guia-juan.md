# Guía de Juan Fernando Jaramillo

**Dominios:** 3 · Seguimiento y eventos, 4 · Evidencias de entrega y 6 · Estado temporal.
**Rama:** `feat/juan-seguimiento` · **Módulos:** `backend/src/modules/seguimiento/`, `evidencias/`, `estado-temporal/`
· **Pantallas:** `frontend/seguimiento/` · **Migraciones:** `200`–`299` · **Gestores:** MongoDB y Redis
(y PostgreSQL para el estado vigente).

Lee primero [guia-equipo.md](guia-equipo.md) (arranque, contratos, Git). El diseño de consistencia de
tu parte ya está acordado en [consistencia.md](consistencia.md): síguelo. Lo marcado "propuesta" lo decides tú.

## 1. Qué pide el enunciado para tu parte

| Dominio | Datos y reglas | Operaciones mínimas |
| --- | --- | --- |
| Seguimiento y eventos | Secuencia temporal de cambios de estado y ubicación simulada; **conservar orden y autor** | Registrar retiro, tránsito, incidencia, entrega; consultar línea de tiempo |
| Evidencias de entrega | Datos heterogéneos: receptor, observación, foto simulada (URL/referencia) | Registrar y consultar prueba de entrega |
| Estado temporal | Última posición simulada / conexión del repartidor con **expiración definida** | Actualizar, consultar y marcar dato no vigente |

- **Pantallas mínimas tuyas:** Consulta de seguimiento por código con línea de tiempo; Vista de repartidor
  (tareas y botones de cambio de estado); Detalle de envío (estados y evidencia).
- **Flujo 3:** el repartidor simula retiro, tránsito e incidencia; el cliente ve el historial de eventos.
- **Flujo 4:** el repartidor confirma entrega y registra evidencia; la web conserva estado actual e historial sin contradicciones.
- **Prueba 4:** reiniciar Redis y distinguir información efímera de historial duradero.
- **Prueba 5:** la entrega registrada permanece tras reinicio; provocar caída del mecanismo de sincronización y explicar la recuperación.
- **Regla:** no asumir que la ubicación temporal equivale a prueba de entrega.
- **Pregunta de investigación:** ¿seguimiento como registros relacionales, documentos o eventos inmutables?

## 2. Lo que ya existe y puedes usar

- **Outbox** en PostgreSQL (`001_base.sql`): cada cambio de estado de un envío ya deja ahí su evento
  (`id` UUID, `secuencia`, `codigo_envio`, `tipo`, `actor`, `datos`, `ocurrido_en`, `intentos`,
  `ultimo_error`, `procesado_en`). Hoy los eventos de Liliana (CREADO, ACEPTADO, CANCELADO) y luego los
  de Camila (ASIGNADO) se acumulan como **pendientes** porque falta tu sincronizador. `GET /health`
  muestra `outbox.pendientes`.
- `db/mongo.js` exporta `db` (base `mensajeria`); `db/redis.js` exporta `cliente` (con contraseña y reconexión).
- Máquina de estados (`shared/estados.js`): `ASIGNADO → RETIRADO`, `RETIRADO → EN_TRANSITO | INCIDENCIA`,
  `EN_TRANSITO → ENTREGADO | INCIDENCIA`, `INCIDENCIA → EN_TRANSITO | CANCELADO`.
- Tabla `envios` (estado vigente). La asignación al repartidor la crea Camila (`asignaciones`).

## 3. Tareas, en orden sugerido

1. **Sincronizador outbox → MongoDB** (diseño en [consistencia.md §1](consistencia.md)): cada pocos
   segundos toma hasta 50 pendientes `ORDER BY secuencia FOR UPDATE SKIP LOCKED`, los inserta en
   `eventos` con `_id` = id del evento (si ya existe, se da por hecho), y marca `procesado_en`. Si Mongo
   falla, suma `intentos` y guarda `ultimo_error`. Para arrancarlo hace falta una línea en `server.js`
   (archivo compartido): proponla en un PR pequeño o en el tuyo, avisando al grupo.
   Índices con `createIndex` al arrancar (idempotente): `{codigo_envio: 1, secuencia: 1}` en `eventos`.
2. **Línea de tiempo** `GET /api/seguimiento/:codigo`: eventos ordenados por `secuencia` desde MongoDB,
   más el estado vigente desde PostgreSQL. Si Mongo está caído, responder `503` o mostrar que la línea
   de tiempo está atrasada; el estado vigente siempre sale de PostgreSQL.
3. **Cambios del repartidor** (retiro, tránsito, incidencia): en una transacción de PostgreSQL, bloquear
   el envío, comprobar que esté asignado a **ese** repartidor (`REP-NNN`, tabla de Camila), `validarTransicion`,
   actualizar `envios.estado` y `registrarEvento` con actor `REP-NNN`. Idempotente si ya está en ese estado.
   La ubicación simulada puede ir en `datos` del evento.
4. **Evidencias y entrega** (diseño en [consistencia.md §2](consistencia.md)): el navegador genera
   `clave_evidencia` (UUID) y la reenvía igual en cada intento; la API guarda la evidencia en MongoDB
   `evidencias` con `_id = clave_evidencia` y **después** confirma `ENTREGADO` en PostgreSQL
   (`evidencia_id`, evento en la outbox y liberar la capacidad del repartidor, acordándolo con Camila).
   Necesitas la columna `envios.evidencia_id`: créala en tu rango, p. ej. `201_evidencia_envio.sql` con
   `ALTER TABLE envios ADD COLUMN evidencia_id uuid UNIQUE;` (avísale a Liliana, es su tabla).
5. **Estado temporal en Redis** (convención en [database/redis/README.md](../database/redis/README.md)):
   `repartidor:REP-001:ubicacion` y `repartidor:REP-001:conexion` con TTL. Define el TTL (propuesta:
   60–120 s) y qué muestra la web cuando la clave expiró ("sin dato vigente"). Si Redis está caído, la API
   sigue funcionando y solo esta parte responde `503`.
6. **Pantallas** en `frontend/seguimiento/`: consulta por código con línea de tiempo; vista de repartidor
   con sus tareas y botones de estado; detalle del envío con su evidencia.
7. **Pruebas** `tests/seguimiento.test.js`: secuencia válida, transición inválida → `409`
   (p. ej. ASIGNADO → ENTREGADO), reintento con la misma `clave_evidencia` no duplica, la evidencia
   aparece en el detalle, TTL expira en Redis.
8. **Documentación:** tu sección en `docs/api.md`, decisiones en la bitácora y README de tus módulos.

## 4. Decisiones que te tocan

| N.º | Tema |
| --- | --- |
| P4 | Plazo (propuesta 10 min) para listar evidencias huérfanas: guardadas en Mongo pero sin envío ENTREGADO que las referencie |
| P6 | Persistencia de Redis: hoy usa instantáneas por defecto (una clave sin TTL sobrevivió al reinicio). Para la prueba 4 decide si basta con TTL o si se desactiva la persistencia; sin tecnologías nuevas |
| — | TTL de ubicación y conexión del repartidor |

Si una incidencia termina en `CANCELADO`, la tabla exige `cancelado_en` y conviene `motivo_cancelacion`
(restricción `envios_cancelacion_coherente`).

## 5. Cómo demostrarlo en la defensa

1. `docker compose stop mongo` → crear y aceptar un envío desde la web: PostgreSQL sigue funcionando y
   `outbox.pendientes` sube en la página de inicio.
2. `docker compose start mongo` → los pendientes bajan a 0 y la línea de tiempo aparece completa, sin duplicados
   (comparar `SELECT count(*) FROM outbox WHERE codigo_envio='ENV-…'` con
   `db.eventos.countDocuments({codigo_envio:'ENV-…'})` en Compass).
3. Repartidor: retiro → tránsito → incidencia → tránsito → entrega con evidencia; la web muestra estado e historial coherentes.
4. `docker compose restart redis`: la ubicación pasa a "sin dato vigente", pero la entrega y el historial siguen.
5. `docker compose down` y `up -d` (sin `-v`): la entrega y la evidencia siguen ahí.

## 6. Mensaje para empezar hoy

```powershell
cd C:\Proyectos
git clone https://github.com/lilianaelizabethaveros-ui/G1_Mensajeria_Urbana.git
cd G1_Mensajeria_Urbana
Copy-Item .env.example .env; notepad .env
docker compose up --build -d; Start-Sleep -Seconds 20; docker compose ps
node --test --test-concurrency=1 "tests/*.test.js"   # debe terminar con fail 0
git switch -c feat/juan-seguimiento
git push -u origin feat/juan-seguimiento
```

Primero acepta la invitación de colaborador que te llegó por correo de GitHub; sin eso no podrás subir tu rama.
