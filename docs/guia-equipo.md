# Guía de inicio para el equipo

Para **Camila Perrazo** y **Juan Fernando Jaramillo**. Resume lo que Liliana ya construyó y probó en las
Fases 1 a 6, cómo levantar el proyecto en tu PC y cómo trabajar sin pisarnos.
Cada uno tiene además su guía: [guia-camila.md](guia-camila.md) y [guia-juan.md](guia-juan.md).

> El enunciado de la docente (Proyecto B, págs. 5-7 del PDF) manda sobre esta guía.
> Las decisiones del grupo están en [bitacora-decisiones.md](bitacora-decisiones.md): las marcadas
> **Aprobada** ya están acordadas; las **P1–P6** siguen abiertas y algunas las deciden ustedes.

## 1. Qué está hecho y verificado

| Fase | Qué se hizo | Cómo se comprobó (en el PC de Liliana) |
| --- | --- | --- |
| 1. Entorno | Docker Desktop, Git, Node 24, VS Code. Se detectó un MongoDB de Windows en el puerto 27017 | Comandos de versión y `hello-world` |
| 2. Estructura | Carpetas por módulo y por integrante, documentación base, reglas de Git | Árbol de 33 archivos |
| 3. Docker Compose | PostgreSQL 17, MongoDB 8 (publicado en **27018**), Redis 7.4 con contraseña y la API (Node 24 + Express 5), con healthchecks, red interna y volúmenes | 4 servicios `healthy`; los datos sobreviven a `down`/`up`; Redis caído no tumba la API |
| 4. API base | Formato único de respuestas y errores, `GET /health`, máquina de estados, códigos `ENV-`/`REP-`, validación, outbox, migraciones SQL automáticas, web de inicio | `tests/contratos.test.js` 10/10, `tests/api.test.js` 6/6 |
| 5. Dominio 1 | Tabla `envios`, `/api/catalogos`, `/api/envios` (crear, consultar, aceptar, cancelar) con outbox e idempotencia; formulario, comprobante y gestión de solicitud | `tests/envios.test.js` 19/19; envío CREADO → ACEPTADO → CANCELADO con 3 eventos en la outbox; datos persisten tras `down`/`up` |
| 6. GitHub | Repositorio, `main` con la infraestructura, rama `feat/liliana-envios`, PR #1 revisado por Camila y unido a `main` | 35/35 pruebas desde `main` |

Arquitectura (ver [arquitectura.md](arquitectura.md)): navegador → API REST → módulos → gestores.
El navegador **nunca** habla con las bases de datos.

| Gestor | Qué guarda | Quién |
| --- | --- | --- |
| PostgreSQL | Envíos y estado vigente, catálogos, repartidores, asignaciones, outbox | Liliana, Camila |
| MongoDB | Eventos de seguimiento (copiados desde la outbox) y evidencias de entrega | Juan Fernando |
| Redis | Ubicación y conexión del repartidor, con expiración (TTL) | Juan Fernando |

## 2. Requisitos en tu PC (Windows)

- Docker Desktop abierto (ballena quieta) · Git · Node.js 24 · VS Code. Opcional: DBeaver y MongoDB Compass.
- Comprueba: `docker --version`, `git --version`, `node --version`.
- Configura tu identidad (una sola vez, con **tu** nombre y tu correo de GitHub):

```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu_correo@ejemplo.com"
```

## 3. Levantar el proyecto por primera vez

```powershell
cd C:\Proyectos
git clone https://github.com/lilianaelizabethaveros-ui/G1_Mensajeria_Urbana.git
cd G1_Mensajeria_Urbana
Copy-Item .env.example .env
notepad .env        # cambia las tres "cambia_esta_clave_local" por claves inventadas tuyas
docker compose up --build -d
Start-Sleep -Seconds 20
docker compose ps   # los 4 servicios deben decir (healthy)
node --test "tests/*.test.js"
```

Debe terminar con `pass 35` y `fail 0`. Abre <http://localhost:3000>: el panel de estado debe mostrar
PostgreSQL, MongoDB y Redis **En línea**.

Si algo falla:

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| `Falta la variable de entorno …` | No existe `.env` o le falta una línea | Volver a copiar `.env.example` |
| `port is already allocated` en 5432, 6379 o 27018 | Otro programa usa ese puerto | Cambia `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT` o `MONGO_HOST_PORT` en **tu** `.env` |
| `node --test tests/` falla con "Cannot find module" | En Node 24 para Windows hay que dar el patrón | Usa `node --test "tests/*.test.js"` |
| Cambié código y no se nota | En Windows `node --watch` no detecta los cambios | `docker compose restart api` |
| Cambié `package.json` o el `Dockerfile` | La imagen está desactualizada | `docker compose up --build -d` |

**Nunca** uses `docker compose down -v` ni borres volúmenes en pruebas normales: borra todos los datos.
Tu `.env` no se sube a GitHub (está en `.gitignore`); no pongas contraseñas reales en ningún archivo.

## 4. Cómo se programa un módulo

Cada módulo ya está registrado en `backend/src/routes/index.js` y hoy responde `501`.
Para desarrollarlo **no editas** `routes/index.js`: reemplazas el contenido de tu `<modulo>.routes.js`
por un `Router` propio. Mira el módulo `envios` como ejemplo completo:

```
envios.routes.js      → rutas (URL → función)
envios.controller.js  → HTTP: lee la petición, elige el código HTTP
envios.service.js     → reglas de negocio y transacciones
envios.repository.js  → consultas SQL
envios.validation.js  → esquemas de validación
```

Contratos compartidos que **debes reutilizar** (no copiarlos):

| Archivo | Qué te da |
| --- | --- |
| `db/postgres.js` | `pool`, `conTransaccion(async (cliente) => …)` |
| `db/mongo.js` | `db` (base `mensajeria`), `verificar` |
| `db/redis.js` | `cliente` |
| `shared/errores.js` | `errores.validacion(detalles)`, `noEncontrado`, `conflicto(codigo, mensaje)`, `noDisponible` |
| `shared/validacion.js` | `validar(cuerpo, esquema)`: limpia, valida y descarta campos no definidos |
| `shared/estados.js` | `ESTADOS`, `TRANSICIONES`, `validarTransicion(desde, hacia)` (409 si no se permite) |
| `shared/identificadores.js` | `esCodigoEnvio`, `normalizarCodigo`, `esCodigoRepartidor` (`REP-NNN`) |
| `shared/outbox.js` | `registrarEvento(cliente, { codigoEnvio, tipo, actor, datos })` |

Respuestas: éxito `{ ok: true, datos }`; error `{ ok: false, error: { codigo, mensaje, detalles } }`
(tabla de códigos HTTP en [api.md](api.md)). En Express 5 basta con `throw`: el `errorHandler` responde.

### Regla de oro para cambiar el estado de un envío

El estado vigente vive en `envios.estado` (PostgreSQL). Quien lo cambie lo hace así, **en una sola transacción**:

```js
await conTransaccion(async (cliente) => {
  const { rows } = await cliente.query(
    'SELECT id, estado FROM envios WHERE codigo = $1 FOR UPDATE', [codigo]);   // bloquea la fila
  if (!rows[0]) throw errores.noEncontrado(`No existe el envío ${codigo}.`);
  // si ya está en el estado pedido → responder sin cambios (idempotente, decisión D33)
  validarTransicion(rows[0].estado, 'ASIGNADO');                               // 409 si no se permite
  await cliente.query(
    'UPDATE envios SET estado = $1, actualizado_en = now() WHERE id = $2', ['ASIGNADO', rows[0].id]);
  // ...tus propias tablas (asignaciones, capacidad, etc.)
  await registrarEvento(cliente, {
    codigoEnvio: codigo, tipo: 'ASIGNADO', actor: 'OPERADOR', datos: { repartidor: 'REP-001' } });
});
```

Así el cambio y su evento en la outbox se guardan juntos o ninguno (decisiones D9 y D16).

### Migraciones

Tus tablas se crean con archivos SQL numerados en `database/postgres/migrations/`:
**Camila 100–199, Juan Fernando 200–299**. La API los aplica sola al arrancar
(`docker compose restart api`). Una migración ya aplicada **no se edita**: se crea otra.
Si necesitas una columna nueva en `envios` (tabla de Liliana), avísale y hazla en **tu** rango con
`ALTER TABLE envios ADD COLUMN …`. Reglas completas: [migraciones](../database/postgres/migrations/README.md).

### Pantallas

Van en tu carpeta de `frontend/` (`despacho/` Camila, `seguimiento/` Juan Fernando), usando
`/css/estilos.css` y `/js/api.js`. Copia la barra superior de `frontend/envios/solicitud.html` para
mantener el mismo diseño. Inserta texto que viene de la API con `textContent`, nunca con `innerHTML`.
Cuando tu pantalla funcione, en tu PR cambia **solo tu tarjeta** de `frontend/index.html`
(enlace y chip "Disponible"), igual que hizo Liliana con "Solicitar envío".

### Pruebas

Agrega `tests/<tu-modulo>.test.js` con `node:test` (sin dependencias nuevas), siguiendo
`tests/envios.test.js`. Antes de cada PR: `node --test "tests/*.test.js"` debe pasar completo.

## 5. Flujo de Git para cada uno

```powershell
# Una sola vez: crear tu rama desde main actualizado
git switch main
git fetch origin
git merge origin/main
git switch -c feat/camila-despacho        # Juan Fernando: feat/juan-seguimiento
git push -u origin feat/camila-despacho

# Cada vez que terminas algo que funciona
git status --short                        # revisa que no aparezca .env
git add <tus archivos>
git commit -m "Despacho: asignar repartidor con control de capacidad"
git push
```

Antes de empezar cada día y antes de abrir el PR, trae lo nuevo de `main` siguiendo
[colaboracion.md](colaboracion.md) (status limpio → `git fetch origin` → `git merge origin/main`).

**Pull Request:** en GitHub → *Pull requests* → *New* → base `main` ← tu rama. Describe qué hiciste,
cómo probarlo y la evidencia (pruebas y capturas). Pide revisión a otra persona del grupo. Al unir,
usa **Create a merge commit** y no borres la rama.

**Prohibido sin acuerdo del grupo:** `git push --force`, `git reset --hard`, `git rebase` sobre ramas
compartidas, editar archivos de otro integrante, agregar dependencias o tecnologías nuevas.
Los archivos compartidos (`docker-compose.yml`, `.env.example`, `package.json`, `backend/src/shared/`,
`server.js`, `app.js`, `css/estilos.css`) se cambian en un PR pequeño y avisado.

## 6. Reglas del enunciado que aplican a todos

- Datos **100 % ficticios**: nombres inventados, teléfonos como `0990000001`, coordenadas inventadas. Nada de datos reales.
- El estado actual no debe contradecir el historial; los cambios de estado deben ser idempotentes y registrar fecha, actor y código de envío.
- No se asume transacción conjunta entre gestores (por eso existe la outbox).
- Defensa: `docker compose up --build -d`, dos flujos completos por la web, una prueba de fallo o concurrencia.
