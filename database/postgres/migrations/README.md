# Migraciones PostgreSQL

Cada cambio de esquema es un archivo SQL numerado en esta carpeta. Al arrancar, la API
(`backend/src/db/migrar.js`, Fase 4) aplica los que falten. Así se agregan tablas nuevas
**sin borrar volúmenes ni perder datos**. No requiere dependencias adicionales (usa `pg`).

## Reglas

1. Nombre: `NNN_descripcion.sql` con tres dígitos, por ejemplo `101_repartidores.sql`.
2. Rangos por integrante, para que dos ramas nunca usen el mismo número:

   | Rango | Responsable |
   | --- | --- |
   | 001–099 | Liliana y archivos compartidos |
   | 100–199 | Camila |
   | 200–299 | Juan Fernando |

3. La tabla `schema_migrations(version, nombre, hash, aplicada_en)` registra lo aplicado.
   Los pendientes se aplican en orden numérico, cada uno en su propia transacción.
   Si uno falla se revierte, la API no arranca y el error aparece en `docker compose logs api`.
   Tras corregir el archivo, ejecuta `docker compose restart api` (la recarga automática no vigila los `.sql`).
4. **Una migración ya aplicada nunca se edita.** Para corregirla se crea otra nueva.
   El aplicador guarda el hash del archivo y avisa si alguien modificó uno aplicado.
5. Las migraciones agregan o alteran. Borrar tablas o columnas con datos requiere acuerdo del grupo.
6. Los datos semilla ficticios también son migraciones (`090_semilla_catalogos.sql`).

## Cómo comprobarlo

En DBeaver:

```sql
SELECT version, nombre, aplicada_en FROM schema_migrations ORDER BY version;
```

## Archivos previstos

| Archivo | Responsable | Fase |
| --- | --- | --- |
| `001_base.sql` — tablas `zonas`, `tipos_servicio` y `outbox` | Compartido | 4 (creada) |
| `002_envios.sql` — tabla `envios` e índices | Liliana | 5 (creada) |
| `090_semilla_catalogos.sql` — 4 zonas y 3 tipos de servicio ficticios | Compartido | 4 (creada) |
| `1NN_*.sql` — repartidores, asignaciones | Camila | posterior |
| `2NN_*.sql` — referencias de evidencia, si hicieran falta | Juan Fernando | posterior |
