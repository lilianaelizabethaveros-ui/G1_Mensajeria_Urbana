# Fuente oficial (Source of Truth) de cada dato

| Dato | Fuente oficial | Copias o derivados | Si el gestor de la copia falla |
| --- | --- | --- | --- |
| Solicitud, envío y **estado vigente** | PostgreSQL `envios` | Eventos en MongoDB | El envío se registra; el evento queda pendiente en la outbox |
| Zonas y tipos de servicio | PostgreSQL | Ninguna | No aplica |
| Repartidores, capacidad, asignaciones | PostgreSQL | Ninguna | No aplica |
| Historial de eventos (orden, actor, fecha) | Outbox en PostgreSQL al escribir | MongoDB `eventos` para consultar; reconstruible desde la outbox | La línea de tiempo se atrasa y se pone al día |
| Evidencia de entrega | MongoDB `evidencias` | `envios.evidencia_id` en PostgreSQL confirma cuál es válida | No se marca ENTREGADO sin evidencia |
| Ubicación y conexión del repartidor | Redis con TTL | Ninguna (efímero) | Se muestra "sin dato vigente"; nunca es prueba de entrega |

## Identificadores compartidos

| Entidad | Formato | Dónde nace | Dónde se reutiliza |
| --- | --- | --- | --- |
| Envío | `ENV-` + 8 caracteres sin letras confusas (ej. `ENV-7K3P9QXM`) | API, `UNIQUE` en PostgreSQL | MongoDB `codigo_envio`, web, Redis si aplica |
| Repartidor | `REP-NNN` (ej. `REP-001`) | PostgreSQL (Camila) | Redis, `actor` en eventos |
| Evento | UUID | Outbox PostgreSQL | `_id` en MongoDB `eventos` |
| Evidencia | UUID (`clave_evidencia`) | Navegador, en cada intento | `_id` en MongoDB, `envios.evidencia_id` |

## Máquina de estados (PROPUESTA P1, pendiente de acuerdo del equipo)

| Estado actual | Puede pasar a | Quién |
| --- | --- | --- |
| CREADO | ACEPTADO, CANCELADO | Operador / Cliente |
| ACEPTADO | ASIGNADO, CANCELADO | Operador |
| ASIGNADO | RETIRADO, ACEPTADO (reasignar/liberar) | Repartidor / Operador |
| RETIRADO | EN_TRANSITO, INCIDENCIA | Repartidor |
| EN_TRANSITO | ENTREGADO, INCIDENCIA | Repartidor |
| INCIDENCIA | EN_TRANSITO, CANCELADO | Operador |
| ENTREGADO, CANCELADO | ninguno (finales) | — |

Cualquier otra transición se rechaza con `409 Conflict`. Pendiente P3: quién cancela un envío ASIGNADO.
