# Guía de Camila Perrazo

**Dominios:** 2 · Despacho y asignaciones, y 5 · Consulta operativa.
**Rama:** `feat/camila-despacho` · **Módulos:** `backend/src/modules/despacho/`, `backend/src/modules/consulta/`
· **Pantallas:** `frontend/despacho/` · **Migraciones:** `100`–`199` · **Gestor:** PostgreSQL.

Lee primero [guia-equipo.md](guia-equipo.md) (arranque, contratos, Git). Lo que aquí dice "propuesta"
es una sugerencia: decides tú y lo anotas en la bitácora.

## 1. Qué pide el enunciado para tu parte

| Dominio | Datos y reglas | Operaciones mínimas |
| --- | --- | --- |
| Despacho y asignaciones | Repartidor, disponibilidad, carga actual y **vínculo único con envío activo** | Asignar, reasignar, liberar capacidad |
| Consulta operativa | Búsqueda por código, zona, estado, destinatario ficticio y fecha | Buscar y filtrar rápidamente; **decidir si se requiere índice derivado** |

- **Pantallas mínimas tuyas:** Panel de despacho (lista, filtros y asignación) y Panel administrativo (zonas, repartidores y capacidades).
- **Flujo obligatorio 2:** el operador encuentra pendientes y asigna un repartidor disponible; el sistema **evita una asignación que exceda su capacidad**.
- **Flujo obligatorio 5:** si separas la consulta del dato oficial (vista derivada), demostrar su sincronización.
- **Prueba de defensa 3:** intentar dos asignaciones incompatibles y comprobar el control de capacidad.
- **Rol administrador:** mantiene zonas, tipos de servicio y capacidad operativa.

## 2. Lo que ya existe y puedes usar

- Tabla `envios` (Liliana, `002_envios.sql`): `codigo`, `estado`, `origen_zona_id`, `destino_zona_id`,
  `destinatario_nombre`, `creado_en`, etc. Índice `(estado, creado_en)` ya creado para listar pendientes.
- Tablas `zonas` y `tipos_servicio` con datos semilla (NORTE, CENTRO, SUR, VALLE; ESTANDAR, EXPRESS, DOCUMENTOS).
- `GET /api/catalogos` (solo lectura). El CRUD administrativo de zonas es tuyo: como cambia el módulo
  `catalogos`, avísale a Liliana antes o créalo dentro de `despacho` con sus propias rutas.
- Un envío **ACEPTADO** es el que está listo para despacho (lo deja así la pantalla "Gestionar solicitud").
- Máquina de estados (`shared/estados.js`): `ACEPTADO → ASIGNADO`, `ASIGNADO → ACEPTADO` (reasignar/liberar),
  `ASIGNADO → RETIRADO` lo hace el repartidor (Juan Fernando).
- Código de repartidor: `REP-NNN` (`esCodigoRepartidor` en `shared/identificadores.js`).

## 3. Tareas, en orden sugerido

1. **Migración `101_repartidores.sql`** (propuesta): tabla `repartidores` con `codigo` `REP-NNN` único,
   nombre ficticio, zona, `capacidad` (> 0), `activo`; y tabla `asignaciones` con `codigo_envio`,
   `repartidor`, `asignada_en`, `liberada_en`. El "vínculo único con envío activo" se puede garantizar
   en la base con un índice único parcial, por ejemplo
   `CREATE UNIQUE INDEX … ON asignaciones (codigo_envio) WHERE liberada_en IS NULL`.
2. **Migración `190_semilla_repartidores.sql`**: 4–6 repartidores ficticios (`REP-001`…) con capacidades distintas.
3. **Asignar** `ACEPTADO → ASIGNADO`: en una sola transacción, bloquear la fila del repartidor
   (`SELECT … FOR UPDATE`) y la del envío, contar su carga actual, rechazar con `409` si excede la
   capacidad, insertar la asignación, cambiar `envios.estado` y registrar el evento `ASIGNADO` con
   `registrarEvento` (actor `OPERADOR`, datos con el repartidor). Patrón completo en
   [guia-equipo.md §4](guia-equipo.md#regla-de-oro-para-cambiar-el-estado-de-un-envío).
4. **Liberar / reasignar** `ASIGNADO → ACEPTADO`: marcar `liberada_en`, devolver la capacidad y registrar el evento.
   La liberación al **entregar** la hará Juan Fernando: acuerden juntos qué función o consulta usará para eso.
5. **Idempotencia** (D33): si el envío ya está asignado a ese mismo repartidor, responder `200` sin evento nuevo.
6. **Consulta operativa** `/api/consulta`: búsqueda con filtros (código, zona, estado, destinatario, rango de fechas)
   sobre PostgreSQL. **Decidir P2:** índices en `envios` (lo más simple; los agregas en tu rango con
   `CREATE INDEX`) o una vista/proyección derivada (entonces hay que demostrar su sincronización, flujo 5).
   Justifica la elección en la bitácora.
7. **Pantallas** en `frontend/despacho/`: panel de despacho (pendientes ACEPTADO, filtros, botón asignar
   con selección de repartidor y su carga) y panel administrativo (repartidores, capacidades, zonas).
8. **Pruebas** `tests/despacho.test.js`: asignación válida, exceso de capacidad → `409`, dos asignaciones
   simultáneas al último cupo → solo una gana, reasignación, búsqueda con filtros.
9. **Documentación:** tu sección en `docs/api.md` (endpoints, payload, códigos HTTP), tus decisiones en
   la bitácora y actualizar los README de tus módulos.

## 4. Decisiones que te tocan

| N.º | Tema |
| --- | --- |
| P2 | ¿Consulta operativa con índices en PostgreSQL o vista derivada? |
| P3 | ¿Quién puede cancelar un envío ASIGNADO? Hoy la solicitud solo cancela en CREADO o ACEPTADO (D34). Si se permite, el despacho debe liberar la capacidad en la misma transacción. Acordar con el grupo |

Si un cambio de estado tuyo lleva a `CANCELADO`, la tabla exige `cancelado_en` (restricción
`envios_cancelacion_coherente`): pon `cancelado_en = now()` y `motivo_cancelacion` en el mismo `UPDATE`.

## 5. Cómo demostrarlo en la defensa

1. Crear un envío desde "Solicitar envío" y aceptarlo en "Gestionar solicitud".
2. En el panel de despacho aparece como pendiente; asignarlo a un repartidor con 1 cupo libre.
3. Intentar asignar otro envío al mismo repartidor → mensaje de capacidad excedida (`409`).
4. En DBeaver: `SELECT * FROM outbox WHERE codigo_envio = 'ENV-…' ORDER BY secuencia;` muestra `ASIGNADO`.
5. Buscar por zona/estado/fecha en la consulta operativa y explicar qué índice se usa (`EXPLAIN`).

## 6. Mensaje para empezar hoy

```powershell
cd C:\Proyectos
git clone https://github.com/lilianaelizabethaveros-ui/G1_Mensajeria_Urbana.git
cd G1_Mensajeria_Urbana
Copy-Item .env.example .env; notepad .env
docker compose up --build -d; Start-Sleep -Seconds 20; docker compose ps
node --test "tests/*.test.js"          # pass 35
git switch -c feat/camila-despacho
git push -u origin feat/camila-despacho
```
