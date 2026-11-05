# Evidencias de los dominios 3, 4 y 6

Dominios: 3 (seguimiento y eventos), 4 (evidencias de entrega) y 6 (estado temporal).
Verificado por Juan Fernando Jaramillo el 05/11/2026, en entorno local con Docker Compose.

## 1. Pruebas automáticas

Comando:

```powershell
node --test --test-concurrency=1 "tests/*.test.js"
```

Resultado: **79 pruebas, 79 aprobadas, 0 fallidas** (0 canceladas, 0 omitidas), duración de 13 064 ms.

Se ejecutan de a un archivo (`--test-concurrency=1`) porque varias pruebas cuentan eventos de la tabla `outbox`; si dos archivos escriben a la vez, los contadores no cuadran.

### Pruebas de los dominios 3, 4 y 6

| Dominio | Prueba | Resultado |
| --- | --- | --- |
| 3 | El sincronizador está activo y la línea de tiempo coincide con la outbox, sin duplicados | Aprobada |
| 3 | Secuencia válida: retiro → tránsito → incidencia → tránsito, con orden y autor | Aprobada |
| 3 | Transición inválida ASIGNADO → EN_TRANSITO responde 409 y no registra evento | Aprobada |
| 3 | ASIGNADO → ENTREGADO se rechaza: la entrega exige evidencia (409) | Aprobada |
| 3 | Otro repartidor no puede cambiar el envío (409 NO_ASIGNADO) | Aprobada |
| 3 | Repetir el mismo cambio es idempotente: 200 y sin evento nuevo | Aprobada |
| 3 | Validación: incidencia sin motivo y códigos mal formados → 400 | Aprobada |
| 3 | Incidencia → cancelado: exige motivo, guarda `cancelado_en` y libera la capacidad | Aprobada |
| 3 | Tareas del repartidor: lista sus envíos en curso con las acciones permitidas | Aprobada |
| 4 | Entrega con evidencia: 201, estado ENTREGADO, capacidad liberada y evidencia en el detalle | Aprobada |
| 4 | Reintento con la misma `clave_evidencia` no duplica la evidencia ni el evento | Aprobada |
| 4 | Evidencia heterogénea: un tercero que recibe exige relación; URL simulada se acepta | Aprobada |
| 4 | Evidencias huérfanas: el listado responde con el plazo de 10 minutos | Aprobada |
| 6 | Ubicación con TTL que corre, y "sin dato vigente" al marcarla no vigente | Aprobada |
| 6 | Valida el plano ficticio y el repartidor | Aprobada |
| 6 | La ubicación temporal no es prueba de entrega: el envío sigue EN_TRANSITO | Aprobada |

### Salida completa de la terminal

```text
✔ GET /health: 200 con los tres gestores ok, outbox y migraciones (119.684ms)
✔ GET /health: no expone credenciales (7.702ms)
✔ Ruta /api inexistente: 404 con formato de error uniforme (2.6128ms)
✔ Todos los módulos implementados: despacho, consulta, seguimiento, evidencias y estado temporal (34.5471ms)
✔ JSON mal formado: 400 JSON_INVALIDO (6.7624ms)
✔ La web de inicio se sirve desde la API (6.8656ms)
▶ Dominio 5: consulta operativa
  ✔ Consultar todos los envíos (8.7251ms)
  ✔ Buscar por código exacto (6.8823ms)
  ✔ Buscar por código parcial (7.4303ms)
  ✔ Filtrar por zona de destino (7.8075ms)
  ✔ Filtrar por estado ACEPTADO (8.2746ms)
  ✔ Filtrar por estado CREADO (7.102ms)
  ✔ Buscar por destinatario ficticio (8.2907ms)
  ✔ Combinar código, zona y estado (6.0364ms)
  ✔ Combinación que no coincide devuelve lista vacía (6.8953ms)
  ✔ Filtrar por rango de fechas (7.9347ms)
  ✔ Rango de fechas sin coincidencias (4.2288ms)
  ✔ Rechazar una fecha inexistente (2.3592ms)
  ✔ Rechazar fechas en orden incorrecto (2.0208ms)
  ✔ Rechazar estado inexistente (1.9884ms)
  ✔ Rechazar paginación inválida (2.144ms)
  ✔ Paginación con límite de un resultado (5.3829ms)
  ✔ La pantalla de consulta está disponible (5.6374ms)
✔ Dominio 5: consulta operativa (226.2213ms)
✔ estados: la secuencia normal es válida (0.8611ms)
✔ estados: CREADO → ENTREGADO se rechaza con 409 TRANSICION_INVALIDA (1.0053ms)
✔ estados: ENTREGADO y CANCELADO son finales (0.1374ms)
✔ estados: un estado inexistente es error de validación (400) (0.1163ms)
✔ identificadores: el código generado cumple el formato y no tiene caracteres confusos (3.4158ms)
✔ identificadores: 10 000 códigos generados no se repiten (15.7495ms)
✔ identificadores: se normalizan minúsculas y espacios (0.2426ms)
✔ validación: limpia los datos y descarta campos no definidos (1.2134ms)
✔ validación: devuelve un detalle por cada campo con error (0.2635ms)
✔ validación: rechaza un cuerpo que no es objeto (0.3083ms)
▶ Dominio 2: despacho y asignaciones
  ✔ Asignación válida: ACEPTADO a ASIGNADO (8.1364ms)
  ✔ D33: repetir la asignación devuelve 200 (15.046ms)
  ✔ Capacidad agotada: responde 409 (8.7895ms)
  ✔ Preparar el último cupo (8.0132ms)
  ✔ Dos asignaciones simultáneas: solo una gana (17.5191ms)
  ✔ Reasignar a otro repartidor disponible (7.32ms)
  ✔ Liberar: ASIGNADO a ACEPTADO (9.3426ms)
  ✔ Consulta de carga de repartidores (2.9155ms)
  ✔ Las pantallas del Dominio 2 están disponibles (11.1671ms)
✔ Dominio 2: despacho y asignaciones (222.0995ms)
✔ GET /api/catalogos: zonas y tipos de servicio activos, sin ids internos (77.891ms)
✔ POST /api/envios: 201, código ENV-XXXXXXXX, estado CREADO y Location (13.7965ms)
✔ POST /api/envios: registra el evento CREADO en la outbox (misma transacción) (20.0355ms)
✔ POST /api/envios: ignora campos que el cliente no puede decidir (estado, precio) (9.3522ms)
✔ POST /api/envios: acepta códigos de catálogo en minúsculas (9.4131ms)
✔ POST /api/envios: la misma Idempotency-Key no duplica el envío (24.2513ms)
✔ POST /api/envios: Idempotency-Key con formato inválido → 400 (3.3558ms)
✔ POST /api/envios: campos obligatorios vacíos → 400 con detalle por campo (2.2649ms)
✔ POST /api/envios: teléfono y peso inválidos → 400 (2.8019ms)
✔ POST /api/envios: peso mayor al máximo del servicio → 400 (regla en el servidor) (2.9212ms)
✔ POST /api/envios: zona inexistente → 400 (3.3286ms)
✔ POST /api/envios: origen y destino idénticos → 400 (2.8543ms)
✔ GET /api/envios/:codigo: devuelve el envío (acepta minúsculas) (10.1966ms)
✔ GET /api/envios/:codigo: formato inválido → 400; inexistente → 404 (4.1018ms)
✔ PATCH aceptar: CREADO → ACEPTADO, y repetirlo no genera otro evento (26.4229ms)
✔ PATCH cancelar: exige motivo (400) y luego cancela con motivo (16.3854ms)
✔ PATCH aceptar sobre un envío CANCELADO → 409 TRANSICION_INVALIDA (15.9664ms)
✔ PATCH cancelar sobre un envío ACEPTADO también es válido (18.7344ms)
✔ Las pantallas del Dominio 1 se sirven desde la API (16.0437ms)
✔ sincronizador: está activo y la línea de tiempo coincide con la outbox (sin duplicados) (602.7908ms)
✔ secuencia válida: retiro → tránsito → incidencia → tránsito, con orden y autor (2130.7537ms)
✔ transición inválida ASIGNADO → EN_TRANSITO responde 409 y no registra evento (37.4515ms)
✔ ASIGNADO → ENTREGADO se rechaza: la entrega exige evidencia (409) (41.0229ms)
✔ otro repartidor no puede cambiar el envío (409 NO_ASIGNADO) (28.6845ms)
✔ repetir el mismo cambio es idempotente: 200 y sin evento nuevo (40.4398ms)
✔ validación: incidencia sin motivo y códigos mal formados → 400 (40.252ms)
✔ incidencia → cancelado: exige motivo, guarda cancelado_en y libera la capacidad (70.8952ms)
✔ tareas del repartidor: lista sus envíos en curso con las acciones permitidas (54.1716ms)
✔ entrega con evidencia: 201, estado ENTREGADO, capacidad liberada y evidencia en el detalle (1618.0329ms)
✔ reintento con la misma clave_evidencia no duplica la evidencia ni el evento (2212.3267ms)
✔ evidencia heterogénea: un tercero que recibe exige relación; URL simulada se acepta (229.9185ms)
✔ evidencias huérfanas: el listado responde con el plazo de 10 minutos (6.5772ms)
✔ estado temporal: ubicación con TTL que corre, y "sin dato vigente" al marcarla no vigente (2934.0823ms)
✔ estado temporal: valida el plano ficticio y el repartidor (471.267ms)
✔ la ubicación temporal no es prueba de entrega: el envío sigue EN_TRANSITO (1045.9917ms)
ℹ tests 79
ℹ suites 0
ℹ pass 79
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 13064.6059
```

## 2. Flujo completo por la web (flujos 3 y 4)

Envío `ENV-ZT4JJ4EE`, repartidor `REP-005`. La pantalla de detalle (`/seguimiento/detalle.html?codigo=ENV-ZT4JJ4EE`) mostró:

- Historial de 7 eventos en orden (#374 a #380): Creado → Aceptado → Asignado → Retirado → Incidencia → En tránsito → Entregado.
- La incidencia registró un motivo y el envío volvió a EN_TRANSITO, como permite la máquina de estados.
- Estado vigente (PostgreSQL): Entregado. Asignación: Liberada al entregar.
- Evidencia de entrega (MongoDB): receptor, observación y referencia de foto simulada.
- Tabla de consistencia: 7 eventos en la outbox (PostgreSQL), 7 copiados (MongoDB), 0 pendientes, y el estado vigente coincide con el último evento del historial.

Capturas: `docs/evidencias/fig9-seguimiento-evidencia.png` y `docs/evidencias/fig10-estado-temporal.png`.

## 3. Control de versiones

- Rama de trabajo: `feat/juan-informe`, creada a partir de `main` actualizado (`f8cb157`).
- Primer commit: `a1634f6`, "Docs: capturas reales de seguimiento, evidencia y estado temporal (Figuras 9 y 10)".

## 4. Prueba 4: reinicio de Redis

Comando: `docker compose restart redis`

Observado: _(completar tras ejecutarla: qué mostró la ubicación del repartidor, y confirmar que la entrega, la evidencia y el historial siguieron intactos)_

## 5. Prueba 5: caída de MongoDB

Comandos: `docker compose stop mongo` → crear y aceptar un envío → `docker compose start mongo`

Observado: _(completar)_

- `outbox.pendientes` antes: __ / con Mongo detenido: __ / después de reiniciar: __
- Envío usado: `ENV-________`
- `SELECT count(*) FROM outbox WHERE codigo_envio = 'ENV-…'` → __
- `db.eventos.countDocuments({ codigo_envio: 'ENV-…' })` → __ (deben coincidir, sin duplicados)

## 6. Persistencia tras reinicio

Comandos: `docker compose down` y luego `docker compose up -d` (sin `-v`).

Observado: _(completar: si la entrega, la evidencia y el historial siguieron presentes)_

## 7. Limitaciones

- No se probó replicación multinodo ni conmutación automática (failover).
- No se midieron latencias de forma cuantitativa.
- Redis no persiste en disco (decisión D40): al reiniciarse arranca vacío, lo cual es coherente con su rol de dato efímero.
- La capacidad del repartidor se libera al entregar (prueba de entrega con evidencia y asignación "Liberada" en el detalle). La decisión P3, sobre cancelar envíos ya ASIGNADOS, sigue abierta.
