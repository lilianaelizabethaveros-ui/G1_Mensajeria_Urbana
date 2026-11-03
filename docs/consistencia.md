# Consistencia entre gestores

No existe una transacción ACID que abarque PostgreSQL, MongoDB y Redis. La consistencia se
garantiza con transacciones **locales**, identificadores idempotentes y reintentos.

## 1. Sincronización outbox → MongoDB

### Tabla `outbox` (PostgreSQL, la crea Liliana)

| Columna | Uso |
| --- | --- |
| `id` (UUID) | Identificador del evento; será `_id` en MongoDB |
| `secuencia` (bigserial) | Orden de los eventos |
| `codigo_envio` | `ENV-XXXXXXXX` |
| `tipo` | CREADO, ACEPTADO, CANCELADO, ASIGNADO, RETIRADO… |
| `actor` | Quién hizo el cambio (cliente, operador, `REP-NNN`) |
| `datos` (jsonb) | Detalle del evento |
| `ocurrido_en` | Fecha y hora del cambio |
| `intentos`, `ultimo_error` | Control de reintentos |
| `procesado_en` | `NULL` mientras está pendiente |

Todo cambio de estado de un envío hace, **en una sola transacción de PostgreSQL**:
actualizar `envios.estado` + insertar la fila en `outbox`. Si algo falla, no se guarda ninguno de los dos.

### Sincronizador (lo implementa Juan Fernando)

Cada pocos segundos, dentro de la API:

1. Toma hasta 50 eventos con `procesado_en IS NULL` ordenados por `secuencia` (`FOR UPDATE SKIP LOCKED`).
2. Los inserta en MongoDB `eventos` con `_id` = `id` del evento. Si ya existe, lo da por hecho (idempotente).
3. Marca `procesado_en = now()`. Si MongoDB falla, suma `intentos`, guarda `ultimo_error` y reintenta en la siguiente vuelta.
4. Si la API se cae entre los pasos 2 y 3, el evento se reenvía al volver; el `_id` repetido evita el duplicado.

Mientras el sincronizador no exista, los eventos se acumulan como pendientes. Es lo esperado.

### Verificación

- `GET /health` → `outbox.pendientes` y antigüedad del pendiente más viejo.
- DBeaver: `SELECT count(*) FROM outbox WHERE procesado_en IS NULL;` debe bajar a 0.
- Por envío: `SELECT count(*) FROM outbox WHERE codigo_envio = 'ENV-…';` debe coincidir con
  `db.eventos.countDocuments({ codigo_envio: 'ENV-…' })` en Compass.

### Prueba de fallo y recuperación (prueba 5 del enunciado)

1. `docker compose stop mongo`
2. Crear o cambiar envíos desde la web → PostgreSQL sigue operando y los pendientes suben.
3. `docker compose start mongo`
4. Los pendientes bajan a 0 y la línea de tiempo aparece completa, sin duplicados.

### Reconstrucción total

Si se pierde la colección `eventos`: `UPDATE outbox SET procesado_en = NULL;` y el sincronizador la
repuebla. Por eso los eventos de la outbox no se borran.

## 2. Entrega con evidencia (diseño; lo implementa Juan Fernando)

Regla: **ningún envío queda ENTREGADO sin evidencia guardada**. Por eso la evidencia se escribe
primero en MongoDB y después se confirma el estado en PostgreSQL.

1. El navegador genera una `clave_evidencia` (UUID) al abrir el formulario y la reenvía igual en cada reintento.
2. La API comprueba en PostgreSQL que el envío esté EN_TRANSITO y asignado a ese repartidor; si no, `409`.
3. Inserta la evidencia en MongoDB `evidencias` con `_id = clave_evidencia`. Si ya existe (reintento), continúa.
4. En una transacción de PostgreSQL:
   `UPDATE envios SET estado='ENTREGADO', evidencia_id=$1 WHERE codigo=$2 AND estado='EN_TRANSITO'`,
   inserta el evento en la outbox y libera la capacidad del repartidor.
5. Si el `UPDATE` no afecta filas y el envío ya está ENTREGADO con esa misma evidencia → `200`
   (reintento idempotente). Con otra evidencia → `409`.

| Fallo | Qué queda | Respuesta | Recuperación |
| --- | --- | --- | --- |
| MongoDB caído en el paso 3 | Nada cambia | `503`, reintento seguro | Reintentar con la misma clave |
| PostgreSQL falla en el paso 4 | Evidencia en Mongo sin confirmar; envío EN_TRANSITO | `503`, reintento seguro | El reintento salta el paso 3 y repite el 4 |
| El usuario no reintenta | Evidencia huérfana | — | Reconciliación: evidencias no referenciadas por un envío ENTREGADO tras 10 min (propuesta P4) se listan para que el operador confirme o descarte |
| Doble clic o red lenta | Dos peticiones con la misma clave | `201` y `200` | Ninguna |

La confirmación oficial está en PostgreSQL: una evidencia es prueba de entrega solo si
`envios.evidencia_id` la referencia. Las evidencias nunca se borran. La ubicación en Redis
nunca sustituye a la evidencia.

## 3. Cuándo se puede reintentar con seguridad

| Operación | ¿Reintento seguro? | Mecanismo |
| --- | --- | --- |
| Crear envío | Se define en la Fase 5 (propuesta: clave de idempotencia) | — |
| Cambio de estado | Sí | Transición condicionada al estado actual |
| Registrar evidencia | Sí | `clave_evidencia` como `_id` |
| Sincronizar outbox | Sí | `_id` = id del evento |
