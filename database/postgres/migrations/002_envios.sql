-- 002_envios.sql · Liliana (Dominio 1: solicitudes y envíos)
-- Fuente oficial del envío y de su estado vigente (decisión D8).
-- Todos los datos de personas y direcciones son FICTICIOS.
-- No editar después de aplicada: los cambios van en una migración nueva.

CREATE TABLE envios (
    id                      bigint        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo                  varchar(12)   NOT NULL UNIQUE
                            CHECK (codigo ~ '^ENV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
    estado                  varchar(20)   NOT NULL DEFAULT 'CREADO'
                            CHECK (estado IN ('CREADO', 'ACEPTADO', 'ASIGNADO', 'RETIRADO',
                                              'EN_TRANSITO', 'INCIDENCIA', 'ENTREGADO', 'CANCELADO')),
    tipo_servicio_id        smallint      NOT NULL REFERENCES tipos_servicio (id),

    -- Remitente y origen
    remitente_nombre        varchar(80)   NOT NULL,
    remitente_telefono      varchar(15)   NOT NULL,
    origen_direccion        varchar(160)  NOT NULL,
    origen_zona_id          smallint      NOT NULL REFERENCES zonas (id),

    -- Destinatario y destino
    destinatario_nombre     varchar(80)   NOT NULL,
    destinatario_telefono   varchar(15)   NOT NULL,
    destino_direccion       varchar(160)  NOT NULL,
    destino_zona_id         smallint      NOT NULL REFERENCES zonas (id),

    -- Paquete
    descripcion             varchar(160)  NOT NULL,
    peso_kg                 numeric(6,2)  NOT NULL CHECK (peso_kg > 0),
    observaciones           varchar(300)  NOT NULL DEFAULT '',

    -- Reintentos seguros del formulario: la misma clave devuelve el mismo envío
    clave_idempotencia      uuid          UNIQUE,

    -- Trazabilidad del estado vigente (el historial completo está en outbox / MongoDB)
    creado_en               timestamptz   NOT NULL DEFAULT now(),
    actualizado_en          timestamptz   NOT NULL DEFAULT now(),
    aceptado_en             timestamptz,
    cancelado_en            timestamptz,
    motivo_cancelacion      varchar(200),

    CONSTRAINT envios_direcciones_distintas
        CHECK (lower(origen_direccion) <> lower(destino_direccion) OR origen_zona_id <> destino_zona_id),
    CONSTRAINT envios_cancelacion_coherente
        CHECK ((estado = 'CANCELADO') = (cancelado_en IS NOT NULL))
);

-- Listados por estado en orden de llegada (panel de despacho, consulta operativa)
CREATE INDEX envios_estado_creado_idx ON envios (estado, creado_en);
-- Claves foráneas consultadas con frecuencia
CREATE INDEX envios_destino_zona_idx ON envios (destino_zona_id);
CREATE INDEX envios_origen_zona_idx ON envios (origen_zona_id);
