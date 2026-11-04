# MongoDB

Base `mensajeria`. Contenido de los Dominios 3 y 4 (responsable: Liliana Averos, ver D38).

No se usan scripts `docker-entrypoint-initdb.d`, porque solo corren con un volumen nuevo.
Las colecciones e índices se crean al arrancar la API con `createIndex`, que es idempotente:
si el índice ya existe, no hace nada.

| Colección | Contenido | `_id` | Índices |
| --- | --- | --- | --- |
| `eventos` | Eventos de seguimiento copiados desde la outbox | id del evento de la outbox (UUID) | `{codigo_envio: 1, secuencia: 1}` único, `{actor: 1, ocurrido_en: -1}` |
| `evidencias` | Pruebas de entrega simuladas (validador `$jsonSchema`) | `clave_evidencia` (UUID) | `{codigo_envio: 1, registrada_en: -1}`, `{registrada_en: 1}` |

Diseño de consistencia: [docs/consistencia.md](../../docs/consistencia.md).

Desde Windows, MongoDB Compass se conecta a `mongodb://<usuario>:<clave>@127.0.0.1:27018/?authSource=admin`
(puerto configurable en `.env`). El 27017 queda libre para un MongoDB instalado en Windows.

Consultas útiles en Compass (pestaña *Mongosh*):

```js
use mensajeria
db.eventos.find({ codigo_envio: 'ENV-…' }).sort({ secuencia: 1 })
db.eventos.countDocuments({ codigo_envio: 'ENV-…' })
db.evidencias.find({ codigo_envio: 'ENV-…' })
```
