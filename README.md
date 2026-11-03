# Proyecto B · Empresa de mensajería urbana

Proyecto final de **Modelado Avanzado de Base de Datos** (Universidad de las Fuerzas Armadas ESPE), Grupo 1.
Integrantes: Liliana Averos, Camila Perrazo y Juan Fernando Jaramillo.

Sistema web para registrar envíos, asignarlos a repartidores y seguir cada paquete, construido con
**persistencia políglota**: PostgreSQL, MongoDB y Redis detrás de una API REST en Node.js + Express.
Todos los datos son ficticios.

> **Estado actual: Fase 5 — Dominio 1 (Solicitudes y envíos).** Compose levanta PostgreSQL, MongoDB, Redis y la API.
> Están listos `GET /health`, el formato de errores, los contratos compartidos, las migraciones, la web de inicio y
> el Dominio 1: formulario de solicitud, comprobante con código único y gestión de la solicitud (aceptar o cancelar).
> Los módulos de Camila y Juan Fernando responden `501` hasta que los desarrollen.

## Pantallas disponibles

| Pantalla | Dirección | Responsable |
| --- | --- | --- |
| Inicio y estado del sistema | <http://localhost:3000> | Compartida |
| Solicitar envío | <http://localhost:3000/envios/solicitud.html> | Liliana Averos |
| Confirmación (comprobante) | `/envios/confirmacion.html?codigo=ENV-…` (se abre al registrar) | Liliana Averos |
| Gestionar solicitud (aceptar / cancelar) | <http://localhost:3000/envios/consulta.html> | Liliana Averos |

## Arquitectura

```
Navegador → API REST (Express, puerto 3000) → módulos de dominio → PostgreSQL | MongoDB | Redis
```

El navegador nunca se conecta a las bases de datos. Detalle en [docs/arquitectura.md](docs/arquitectura.md).

| Gestor | Qué guarda | Fuente oficial de |
| --- | --- | --- |
| PostgreSQL | Envíos, catálogos, repartidores, asignaciones, outbox | Estado vigente del envío, capacidad |
| MongoDB | Eventos de seguimiento, evidencias de entrega | Evidencias (confirmadas desde PostgreSQL) |
| Redis | Última ubicación y conexión del repartidor (con TTL) | Dato efímero, nunca prueba de entrega |

## Reparto de trabajo

| Integrante | Dominios | Carpetas principales |
| --- | --- | --- |
| Liliana Averos | Infraestructura compartida + Dominio 1 (solicitudes y envíos) | `modules/envios`, `modules/catalogos`, `frontend/envios` |
| Camila Perrazo | Dominio 2 (despacho) y Dominio 5 (consulta operativa) | `modules/despacho`, `modules/consulta`, `frontend/despacho` |
| Juan Fernando Jaramillo | Dominios 3 (seguimiento), 4 (evidencias) y 6 (estado temporal) | `modules/seguimiento`, `modules/evidencias`, `modules/estado-temporal`, `frontend/seguimiento` |

## Requisitos previos (Windows)

- Git
- Docker Desktop (motor Linux en ejecución)
- Visual Studio Code (recomendado)
- Node.js 20 o superior (opcional: autocompletado y pruebas)

## Puesta en marcha (PowerShell)

Abre Docker Desktop y espera a que diga *Engine running*. Luego, en la carpeta del proyecto:

```powershell
# Solo la primera vez: crear tu archivo de variables local (no se sube a GitHub)
Copy-Item .env.example .env

# Construir la imagen de la API e iniciar todo en segundo plano
docker compose up --build -d

# Ver el estado: los cuatro servicios deben aparecer como (healthy)
docker compose ps

# Comprobar que la API se comunica con los tres gestores
Invoke-RestMethod http://localhost:3000/health | ConvertTo-Json -Depth 5
```

`/health` responde `200` con `"ok": true` si los tres gestores contestan, o `503` indicando cuál está caído.
La API no se detiene si un gestor cae: sigue atendiendo y se reconecta cuando vuelve.

Web: abre **http://localhost:3000** en el navegador. La página de inicio muestra el estado del sistema.

Al arrancar, la API aplica las migraciones SQL pendientes (`database/postgres/migrations`). Si PostgreSQL aún no
responde, reintenta cada 5 s. Si una migración tiene un error, la API no arranca: corrige el archivo y ejecuta
`docker compose restart api`.

## Pruebas automáticas

Requieren Node.js en tu equipo (no hace falta `npm install`). Desde la raíz del proyecto:

```powershell
# Contratos compartidos (estados, códigos, validación). No necesita Docker.
node --test tests/contratos.test.js

# API en ejecución (requiere docker compose up --build -d)
node --test tests/api.test.js

# Dominio 1: solicitudes y envíos (API en ejecución)
node --test tests/envios.test.js

# Todo junto
node --test "tests/*.test.js"
```

`tests/envios.test.js` crea algunos envíos ficticios con `[PRUEBA]` en la descripción; no borra datos.

### Servicios y puertos

| Servicio | Imagen | Puerto en tu equipo | Uso desde Windows |
| --- | --- | --- | --- |
| postgres | `postgres:17-alpine` | `127.0.0.1:5432` | DBeaver |
| mongo | `mongo:8.0` | `127.0.0.1:27018` | MongoDB Compass |
| redis | `redis:7.4-alpine` | `127.0.0.1:6379` | `redis-cli` dentro del contenedor |
| api | `node:24-alpine` (se construye) | `127.0.0.1:3000` | Navegador: web y API |

Los puertos solo escuchan en `127.0.0.1`: otras computadoras de la red no pueden conectarse.
Si alguno ya está ocupado en tu equipo, cámbialo en `.env` (`POSTGRES_HOST_PORT`, `MONGO_HOST_PORT`, `REDIS_HOST_PORT`).
Usuarios y claves: los de tu `.env` (en `.env.example` son ficticios).

### Detener, reiniciar y ver registros

| Acción | Comando | ¿Conserva los datos? |
| --- | --- | --- |
| Detener sin borrar contenedores | `docker compose stop` | Sí |
| Volver a iniciar | `docker compose start` o `docker compose up -d` | Sí |
| Reiniciar un servicio | `docker compose restart postgres` | Sí |
| Reconstruir la API tras cambiar `package.json` | `docker compose up --build -d api` | Sí |
| Detener y quitar contenedores y red | `docker compose down` | Sí (los volúmenes quedan) |
| Ver registros de un servicio | `docker compose logs -f mongo` | — |
| **Borrar TODO, incluidos los datos** | `docker compose down -v` | **No. Solo con acuerdo del grupo** |

El código de `backend/src` y `frontend/` se monta dentro del contenedor y la API se reinicia sola al guardar
(`node --watch`). Si en tu equipo no se recarga, usa `docker compose restart api`.

Los datos viven en los volúmenes `mensajeria_pg_data`, `mensajeria_mongo_data` y `mensajeria_redis_data`.

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Fuente oficial de cada dato](docs/source-of-truth.md)
- [Consistencia: entregas y outbox](docs/consistencia.md)
- [API REST](docs/api.md)
- [Migraciones PostgreSQL](database/postgres/migrations/README.md)
- [Colaboración con Git y GitHub](docs/colaboracion.md)
- [Bitácora de decisiones](docs/bitacora-decisiones.md)
