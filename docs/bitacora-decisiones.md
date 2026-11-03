# Bitácora de decisiones y evidencias — Proyecto B (mensajería urbana), Grupo 1

Registro de lo verificado realmente y de lo decidido. Insumo para el informe técnico.
No contiene resultados inventados. Estados: **Aprobada** (acordada por Liliana) ·
**Propuesta** (pendiente de acuerdo del equipo).

## Fase 1 — Verificación del entorno de Liliana (2026-11-03)

### Herramientas (comprobadas ejecutándolas, no solo instaladas)

| Herramienta | Versión | Prueba realizada | Resultado |
| --- | --- | --- | --- |
| Node.js | v24.14.1 | `node -e "console.log(...)"` | OK |
| npm | 11.11.0 | `npm --version` | OK |
| Git | 2.50.1.windows.1 | `git config --global user.name/email` | Identidad configurada |
| Docker Engine | 29.5.2 (OS linux) | `docker info`, `docker run --rm hello-world` | OK tras abrir Docker Desktop |
| Docker Compose | v5.1.4 | `docker compose version` | OK |
| VS Code | 1.144.1 | `code --version` | OK |

Incidencia: el primer `docker info` falló (`dockerDesktopLinuxEngine` no encontrado) porque
Docker Desktop estaba cerrado. Se resolvió abriéndolo.

### Puertos y conflictos

- Puertos 3000, 8080, 5432 y 6379: libres.
- Puerto 27017: ocupado por un MongoDB 9.0 instalado como servicio de Windows (inicio automático,
  escucha en 127.0.0.1:27017).
- Contenedores previos de otros trabajos: detenidos, sin puertos. No se tocan.
- Volúmenes y redes de otros proyectos: no se tocan.

## Decisiones

| N.º | Decisión | Alternativa descartada y motivo | Estado | Fecha |
| --- | --- | --- | --- | --- |
| D1 | Nombre de proyecto Compose `mensajeria` (prefijo propio de volúmenes y redes) | Nombre por defecto de la carpeta: riesgo de colisión | Aprobada | 2026-11-03 |
| D2 | MongoDB del proyecto publicado en `127.0.0.1:27018`; puerto interno 27017 | Detener el MongoDB de Windows: afecta otros trabajos | Aprobada | 2026-11-03 |
| D3 | Puertos de bases publicados solo en `127.0.0.1` | Publicar en todas las interfaces: el enunciado pide no exponerlos | Aprobada | 2026-11-03 |
| D4 | Monolito modular en Express, un módulo por dominio | Microservicios: complejidad sin necesidad | Aprobada | 2026-11-03 |
| D5 | La API sirve el frontend estático en el puerto 3000 | Contenedor Nginx: otra tecnología y CORS/proxy | Aprobada | 2026-11-03 |
| D6 | Prefijo de URL por módulo y rutas pre-registradas | Router compartido: conflictos de Git | Aprobada | 2026-11-03 |
| D7 | Códigos compartidos `ENV-XXXXXXXX` y `REP-NNN` | UUID visible: difícil de dictar | Aprobada | 2026-11-03 |
| D8 | PostgreSQL es la fuente oficial del estado vigente | Estado solo en MongoDB: sin control transaccional | Aprobada | 2026-11-03 |
| D9 | Outbox en PostgreSQL y sincronización eventual a MongoDB | Escritura doble directa: inconsistencias si falla la segunda | Aprobada | 2026-11-03 |
| D10 | Máquina de estados única en `shared/estados.js` | Reglas por módulo: contradicciones | Aprobada (contenido en P1) | 2026-11-03 |
| D11 | Dependencias: solo express, pg, mongodb, redis; validación propia, `node --test`, `node --watch` | Joi/Zod, Jest, nodemon: innecesarios | Aprobada | 2026-11-03 |
| D12 | Puertos del equipo configurables en `.env` | Puertos fijos: chocan con servicios locales | Aprobada | 2026-11-03 |
| D13 | Catálogos de zonas y tipos de servicio creados por Liliana; CRUD de Camila | Esperar a Camila: el formulario no podría validarse | Aprobada | 2026-11-03 |
| D14 | Migraciones SQL numeradas por rangos, aplicadas por la API al arrancar | Scripts `init`: solo con volumen nuevo. Flyway: otra tecnología | Aprobada | 2026-11-03 |
| D15 | Evidencia primero en MongoDB, luego ENTREGADO en PostgreSQL, con clave idempotente | Estado primero: ENTREGADO sin evidencia | Aprobada (diseño; implementa Juan) | 2026-11-03 |
| D16 | Sincronizador idempotente (`_id` = id del evento), verificable en `/health` | Copia sin identificador: duplicados al reintentar | Aprobada (diseño; implementa Juan) | 2026-11-03 |
| D17 | Actualizar ramas con `git status` limpio + `git fetch origin` + `git merge origin/main` | `git pull` o `rebase`: menos visible / reescribe historia | Aprobada | 2026-11-03 |
| D18 | Índices de MongoDB creados al arrancar con `createIndex` (idempotente) | Scripts init de Mongo: solo con volumen nuevo | Aprobada (derivada de D14) | 2026-11-03 |
| D19 | Imágenes con versión fija: `postgres:17-alpine`, `mongo:8.0`, `redis:7.4-alpine` | `latest`: cada integrante podría bajar una versión distinta | Aprobada | 2026-11-03 |
| D20 | Health checks en los tres gestores (`pg_isready`, `ping` de Mongo, `PING` de Redis) | Solo "contenedor iniciado": no garantiza que acepte conexiones | Aprobada | 2026-11-03 |
| D21 | Redis con contraseña (`requirepass`) y variables obligatorias (`${VAR:?}`) que fallan con mensaje claro si falta `.env` | Redis sin clave; valores por defecto silenciosos | Aprobada | 2026-11-03 |
| D22 | Imagen de la API `node:24-alpine`, construida desde la raíz (`backend/Dockerfile`) para incluir `frontend/` y `database/`; `.dockerignore` en la raíz | Contexto `backend/`: la imagen no tendría la web ni las migraciones | Aprobada | 2026-11-03 |
| D23 | La API espera a que los tres gestores estén `healthy` (`depends_on`), pero si uno cae después sigue funcionando y `/health` responde `503` indicando cuál | Detener la API ante cualquier caída: contradice la regla de que el registro siga operando | Aprobada | 2026-11-03 |
| D24 | Desarrollo con código montado (`backend/src`, `frontend/`, `database/` en solo lectura) y `node --watch` | Reconstruir la imagen en cada cambio: lento | Aprobada. Nota Fase 4: en Windows la recarga automática no funcionó; el código sí se monta, basta `docker compose restart api` | 2026-11-03 |
| D25 | Puerto de la API publicado solo en `127.0.0.1:3000` | Todas las interfaces: innecesario para el laboratorio | Aprobada | 2026-11-03 |
| D26 | Formato único de error `{ok:false, error:{codigo, mensaje, detalles}}` con tabla de códigos HTTP y si se puede reintentar (`docs/api.md`) | Cada módulo con su propio formato: el frontend no podría mostrar errores de forma uniforme | Aprobada | 2026-11-03 |
| D27 | Módulos no implementados registrados con un router provisional que responde `501` | No registrarlos: cada integrante tendría que editar `routes/index.js` | Aprobada | 2026-11-03 |
| D28 | La API reintenta cada 5 s si PostgreSQL no responde al arrancar; un error de SQL detiene el arranque | Salir siempre: con `node --watch` el contenedor quedaría detenido sin reiniciarse | Aprobada | 2026-11-03 |
| D29 | `outbox` con `CHECK` del formato `ENV-XXXXXXXX`, índice parcial de pendientes e índice por envío | Sin restricciones: datos inválidos llegarían a MongoDB | Aprobada | 2026-11-03 |
| D30 | Pruebas con `node --test` sin dependencias: `tests/contratos.test.js` (sin Docker) y `tests/api.test.js` (API en ejecución) | Jest o Mocha: dependencias extra | Aprobada | 2026-11-03 |
| D31 | Tabla `envios` en `002_envios.sql`: código único con `CHECK`, estado con `CHECK`, claves foráneas a catálogos, `CHECK` de cancelación coherente e índice `(estado, creado_en)` | Validar solo en la API: un error de código dejaría datos inválidos en la fuente oficial | Aprobada | 2026-11-03 |
| D32 | Idempotencia al crear con el encabezado `Idempotency-Key` (UUID) guardado en `envios.clave_idempotencia` `UNIQUE`; repetir devuelve `200` con el mismo envío (resuelve P5) | Detectar duplicados por datos iguales: dos envíos legítimos idénticos serían rechazados | Aprobada | 2026-11-03 |
| D33 | Aceptar y cancelar son idempotentes: si el envío ya está en el estado pedido se responde `200` con `cambiado: false` y sin evento nuevo | Responder `409`: un reintento por red lenta parecería un error | Aprobada | 2026-11-03 |
| D34 | Desde las solicitudes solo se acepta (`CREADO`) y se cancela (`CREADO` o `ACEPTADO`); desde `ASIGNADO` decide despacho (P3 sigue abierta) | Permitir cancelar en cualquier estado: chocaría con la capacidad de Camila y las entregas de Juan Fernando | Aprobada | 2026-11-03 |
| D35 | El servidor valida zonas, tipo de servicio y peso máximo contra el catálogo de PostgreSQL e ignora campos que el cliente no decide (`estado`, `codigo`, `precio`) | Confiar en el formulario: cualquiera puede enviar otra petición con `curl` | Aprobada | 2026-11-03 |
| D36 | Pantalla "Gestionar solicitud" (`consulta.html`) dentro del Dominio 1 para buscar por código, aceptar y cancelar | Esperar al panel de Camila: no se podría demostrar el flujo CREADO → ACEPTADO → CANCELADO del Dominio 1 | Aprobada | 2026-11-03 |
| D37 | Entrega estimada calculada al consultar (`creado_en` + horas del tipo de servicio), sin guardarla | Guardarla en una columna: se desincronizaría si cambia el catálogo; queda abierto si se prefiere congelarla | Aprobada | 2026-11-03 |

## Propuestas pendientes de acuerdo

| N.º | Tema | Quién decide |
| --- | --- | --- |
| P1 | Transiciones concretas de la máquina de estados (`docs/source-of-truth.md`) | Equipo |
| P2 | ¿La consulta operativa necesita vista derivada o bastan índices PostgreSQL? | Camila |
| P3 | ¿Quién puede cancelar un envío ASIGNADO? | Equipo |
| P4 | Plazo de 10 min para reconciliar evidencias huérfanas | Juan Fernando |
| P5 | Idempotencia al crear envíos (clave de idempotencia) | Resuelta con D32 (aprobada) |
| P6 | Persistencia de Redis (instantáneas por defecto, AOF o ninguna) según cómo se quiera demostrar la prueba 4 | Juan Fernando |

## Fase 2 — Estructura inicial (2026-11-03)

Estructura extraída en `C:\Proyectos\proyecto-mensajeria` en el equipo de Liliana.

| Comprobación | Esperado | Obtenido |
| --- | --- | --- |
| `(Get-ChildItem -Recurse -File -Force).Count` | 33 | 33 |
| `(Get-ChildItem -Recurse -Directory -Force).Count` | 29 | 29 |
| `tree /F /A` | Árbol de la propuesta | Coincide |

Sin Docker Compose ni código JavaScript todavía (Fases 3 y 4).

## Fase 3 — Docker Compose

### Paso 3.1: gestores de persistencia (2026-11-03)

- `docker compose config` validado antes de entregarlo: proyecto `mensajeria`, red `mensajeria_red`,
  volúmenes `mensajeria_pg_data`, `mensajeria_mongo_data`, `mensajeria_redis_data`, puertos en `127.0.0.1`
  (5432, 27018, 6379). Sin `.env`, Compose se detiene con el mensaje "Falta … en .env".

Resultado en el equipo de Liliana:

| Comprobación | Resultado obtenido |
| --- | --- |
| `docker compose config --quiet` | Sin salida (válido) |
| `docker compose up -d` | Imágenes descargadas; red `mensajeria_red` y 3 volúmenes `mensajeria_*` creados; 3 contenedores iniciados |
| `docker compose ps` | mongo, postgres y redis `Up (healthy)` |
| `psql … SELECT version();` | PostgreSQL 17.11 |
| `mongosh … db.runCommand({ping:1})` | `{ ok: 1 }` |
| `redis-cli ping` (con clave vía `REDISCLI_AUTH`) | `PONG` |
| `netstat` | 5432, 6379 y 27018 escuchando solo en `127.0.0.1` |

Incidencia: el primer `Expand-Archive` falló porque el zip aún no estaba en Descargas; Compose respondió
`no configuration file provided`. Se resolvió descargándolo y extrayéndolo de nuevo.

### Paso 3.2: contenedor de la API (2026-11-03)

Pruebas hechas por Claude **fuera de Docker**, con PostgreSQL 16 y Redis 7.0 locales y sin MongoDB disponible
(no se pudo descargar en ese entorno). No sustituyen la prueba en el equipo de Liliana:

| Prueba | Resultado |
| --- | --- |
| `/health` con Mongo apagado | `503`; postgres y redis `ok`, mongo `caido` (ECONNREFUSED); la API sigue respondiendo |
| Apagar y volver a encender Redis | `caido` → `ok` sin reiniciar la API |
| Apagar y volver a encender PostgreSQL | `caido` → `ok` sin reiniciar la API |
| Mongo sigue caído | Cada `/health` reintenta conectar (no queda bloqueado) |
| Falta una variable obligatoria | La API termina con "Falta la variable de entorno …" |
| `SIGTERM` (lo que envía `docker compose stop`) | Cierra conexiones y termina |
| Clave con caracteres especiales en la URL de Mongo | Se codifica con `encodeURIComponent` |
| `docker compose config` | Válido |

No probado aquí: la construcción de la imagen, la conexión real a MongoDB y la recarga con `node --watch`
sobre carpetas de Windows.

Resultado en el equipo de Liliana:

| Comprobación | Resultado obtenido |
| --- | --- |
| `docker compose up --build -d` | Imagen `mensajeria-api` construida (97 paquetes, 0 vulnerabilidades); la API arrancó después de que los 3 gestores estuvieran `Healthy` |
| `docker compose ps` | api, mongo, postgres y redis `Up (healthy)`; API en `127.0.0.1:3000` |
| `GET /health` | `200`, `ok: true`; postgres 4 ms, mongo 4 ms, redis 5 ms |
| Logs de la API | `[postgres] conectado`, `[mongo] conectado`, `[redis] conectado` |
| `docker compose stop redis` + `/health` | `503`; redis `caido` ("sin conexión"), postgres y mongo `ok`; la API siguió respondiendo |
| `docker compose start redis` + `/health` | `200`; redis `ok` sin reiniciar la API |

Queda confirmado que la API se comunica con los tres gestores por la red interna y tolera la caída de uno.

### Paso 3.3: persistencia tras eliminar y recrear contenedores (2026-11-03)

Datos de prueba creados en los tres gestores, luego `docker compose down` (sin `-v`) y `docker compose up -d`.

| Comprobación | Resultado obtenido |
| --- | --- |
| `docker compose down` | 4 contenedores y la red eliminados |
| `docker volume ls --filter name=mensajeria` | `mensajeria_mongo_data`, `mensajeria_pg_data`, `mensajeria_redis_data` siguen existiendo |
| `docker compose up -d` | Los 4 servicios `healthy` de nuevo |
| PostgreSQL `SELECT * FROM prueba_persistencia` | Fila `1 | antes del reinicio` conservada |
| MongoDB `prueba_persistencia.find()` | Documento conservado (mismo `ObjectId`) |
| Redis `GET prueba:persistencia` | `"antes del reinicio"` conservado |
| Redis `TTL prueba:efimera` (EX 30) | `-2`: la clave expiró |
| Limpieza | Tabla, colección y clave de prueba eliminadas |

Observación para P6: con la configuración por defecto, Redis guardó una instantánea al detenerse y la clave sin
expiración sobrevivió al reinicio. Lo efímero se distingue por el TTL, no por el reinicio. Juan Fernando decidirá si
mantiene ese comportamiento para la prueba 4 del enunciado.

**Fase 3 completa.**

## Fase 4 — API REST base (2026-11-03)

Archivos nuevos: `shared/` (errores, validacion, estados, identificadores, outbox, moduloPendiente),
`middleware/` (errorHandler, notFound), `routes/index.js`, routers provisionales de los 7 módulos,
`db/migrar.js`, `conTransaccion` en `db/postgres.js`, migraciones `001_base.sql` y `090_semilla_catalogos.sql`,
web de inicio (`index.html`, `css/estilos.css`, `js/api.js`, `js/inicio.js`) y pruebas en `tests/`.
Respecto al árbol de la Fase 2, las pruebas se llaman `contratos.test.js` y `api.test.js` en lugar de `health.test.js`.

Pruebas hechas por Claude fuera de Docker (PostgreSQL 16 y Redis 7.0 locales, sin MongoDB):

| Prueba | Resultado |
| --- | --- |
| `node --test tests/contratos.test.js` | 10 de 10 correctas |
| `node --test tests/api.test.js` | 5 de 6; falla solo la de `/health` 200 porque no había MongoDB |
| Primer arranque | Aplicadas `001_base.sql` y `090_semilla_catalogos.sql`; 4 zonas y 3 tipos de servicio |
| Segundo arranque | `0 nuevas, 2 en total` |
| Migración aplicada modificada | Aviso "cambió después de aplicarse"; no se reejecuta |
| Nombre inválido / número duplicado | La API no arranca y explica el motivo |
| Migración con error de SQL | Revertida (tabla no creada, no registrada); tras corregirla se aplica |
| PostgreSQL apagado al arrancar | Reintentos cada 5 s; arranca al volver PostgreSQL |
| `conTransaccion` + `registrarEvento` | COMMIT guarda el evento; un error provoca ROLLBACK; el CHECK rechaza códigos inválidos |
| Rutas de módulos pendientes (incluso anidadas) | `501 NO_IMPLEMENTADO` con el responsable |
| JSON mal formado / cuerpo de 200 KB | `400 JSON_INVALIDO` / `413 CUERPO_DEMASIADO_GRANDE` |
| Web de inicio en navegador sin interfaz | Tabla de estado con gestores, outbox y migraciones; sin errores de consola |

Resultado en el equipo de Liliana:

| Comprobación | Resultado obtenido |
| --- | --- |
| Archivos tras extraer `fase4.zip` | 71 (incluye su `.env`) |
| Recarga automática (`node --watch`) al cambiar archivos desde Windows | **No se recargó**: los logs no mostraron reinicio. Se usa `docker compose restart api` (alternativa ya documentada en el README) |
| `docker compose restart api` | Cierre ordenado (SIGTERM); aplicadas `001_base.sql` y `090_semilla_catalogos.sql` (`2 nuevas, 2 en total`); 3 gestores conectados |
| `GET /health` | `200`, `ok: true`; outbox `pendientes: 0`; migraciones `aplicadas: 2, ultima: 90` |
| `schema_migrations` y `zonas` | Versiones 1 y 90; 4 zonas (NORTE, CENTRO, SUR, VALLE) |
| `node --test tests/contratos.test.js` | 10 de 10 correctas |
| `node --test tests/api.test.js` | 6 de 6 correctas |
| Web `http://localhost:3000` | Se muestra con los tres gestores en `ok` (captura de Liliana) |

Ajuste visual posterior: a pedido de Liliana se rediseñó la página de inicio (portada con los integrantes del Grupo 1,
diagrama de arquitectura, tarjetas por responsable y panel de estado). Revisado en navegador sin interfaz a 1440 px
y 390 px de ancho, con todos los gestores en línea y con Redis caído.

## Fase 5 — Dominio 1: solicitudes y envíos (2026-11-03)

Archivos nuevos: migración `002_envios.sql`; módulo `catalogos` (`catalogos.repository.js`, `catalogos.routes.js`);
módulo `envios` (`envios.validation.js`, `envios.repository.js`, `envios.service.js`, `envios.controller.js`,
`envios.routes.js`); pantallas `frontend/envios/` (`solicitud`, `confirmacion`, `consulta` y `envios.js`);
`tests/envios.test.js`. Modificados: `index.html` (tarjeta "Solicitar envío" enlazada y navegación),
`css/estilos.css` (estilos de formularios y comprobante, agregados al final), `docs/api.md` (sección Liliana),
`README.md`, README de los módulos `envios` y `catalogos`, `frontend/README.md`.

Pruebas hechas por Claude fuera de Docker (PostgreSQL 16 y Redis 7.0 locales, sin MongoDB):

| Prueba | Resultado |
| --- | --- |
| Migración 002 con 001 y 090 ya aplicadas (situación del equipo de Liliana) | Se aplica `002_envios.sql`: `1 nuevas, 3 en total` |
| `node --test tests/envios.test.js` | 19 de 19 correctas |
| `node --test tests/contratos.test.js` | 10 de 10 correctas |
| `node --test tests/api.test.js` | 5 de 6; falla solo `/health` 200 porque no había MongoDB (igual que en la Fase 4) |
| 8 `POST` simultáneos con la misma `Idempotency-Key` | 1 respuesta `201` y 7 `200`; un solo envío y un solo evento `CREADO` |
| 8 `PATCH aceptar` simultáneos | Solo uno con `cambiado: true`; eventos del envío: `CREADO, ACEPTADO` |
| Envíos sin evento `CREADO` en la outbox | 0 |
| Pantallas en navegador sin interfaz a 1440 px y 390 px | Errores por campo, registro, comprobante, aceptar, cancelar con motivo y código inexistente; sin desbordes horizontales. Único error de consola: el `404` esperado al buscar un código inexistente |

Resultado en el equipo de Liliana:

| Comprobación | Resultado obtenido |
| --- | --- |
| `node --test tests/` | No válido en Node 24 en Windows (toma `tests` como módulo). Se cambió la documentación a `node --test "tests/*.test.js"` |
| `docker compose logs api` justo tras `restart` | Mostraba solo el cierre; además se registraban los `501` esperados con su traza. Se ajustó `errorHandler` para no registrar `501` y se añadió `Start-Sleep -Seconds 5` |
| Arranque tras el ajuste | `0 nuevas, 3 en total` (la `002_envios.sql` se aplicó en el reinicio anterior); 3 gestores conectados |
| `node --test "tests/*.test.js"` | 35 de 35 correctas (10 contratos, 6 API, 19 envíos) |
| Pantallas (paso 3) | Errores por campo; registro `ENV-G2KPR9W7` (Express, 9.96 kg); comprobante; aceptar; cancelar con motivo; botones desactivados según estado (capturas de Liliana) |
| `envios` y `outbox` del envío (paso 4) | `CANCELADO`, motivo guardado; eventos 16 `CREADO`/CLIENTE, 17 `ACEPTADO`/OPERADOR, 18 `CANCELADO`/OPERADOR |
| Conteos | 11 envíos (10 de las pruebas + 1 manual) y 18 eventos (15 de las pruebas + 3 manuales): cuadran exactamente |
| `docker compose down` + `up -d` sin `-v` (paso 5) | 4 servicios `healthy`; siguen 11 envíos y 18 eventos |

Nota: en la prueba manual se usaron nombres y teléfonos reales; para la demo se usarán solo datos ficticios.
**Fase 5 verificada en el equipo de Liliana.**

## Fase 6 — Repositorio en GitHub (2026-11-03)

Repositorio público `G1_Mensajeria_Urbana` (cuenta de Liliana), sin README, `.gitignore` ni licencia
generados por GitHub. Colaboradores invitados: Camila Perrazo y Juan Fernando Jaramillo.

| Paso | Resultado en el equipo de Liliana |
| --- | --- |
| Commit inicial en `main` (`781a04e`) | 70 archivos de infraestructura compartida; `git check-ignore` confirmó que `.env` no se sube |
| Rama `feat/liliana-envios` | 3 commits: `334ea8d` API, `2b0bdc3` pantallas, `d1051ee` pruebas y documentación; 35/35 pruebas antes de los commits |
| Carpeta de trabajo | Se pasó a `C:\Proyectos\G1_Mensajeria_Urbana`; mismos volúmenes `mensajeria_*`, datos conservados |
| Pull Request #1 | Revisado y aprobado por Camila; unido con *merge commit* (`f72f281`); la rama se conserva |
| `main` local tras `fetch` + `merge` | Avance rápido a `f72f281`; 35/35 pruebas |

## Fase 7 — Guías para el equipo (2026-11-03)

Se agregan `docs/guia-equipo.md` (resumen de las Fases 1 a 6, arranque, contratos compartidos, Git y PR),
`docs/guia-camila.md` (Dominios 2 y 5) y `docs/guia-juan.md` (Dominios 3, 4 y 6). Solo describen lo que pide
el enunciado, lo que ya existe y el orden sugerido; no implementan nada de sus módulos. Se actualizan
`colaboracion.md`, `consistencia.md` (creación idempotente resuelta con D32) y el README de migraciones.

