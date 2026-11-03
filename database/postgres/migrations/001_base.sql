-- 001_base.sql · Compartido (Liliana)
-- Catálogos que usa el formulario de solicitud y tabla outbox para sincronizar
-- eventos hacia MongoDB (decisiones D9, D13 y D16).
-- No editar después de aplicada: los cambios van en una migración nueva.

-- Zonas de cobertura de la ciudad (ficticias)
CREATE TABLE zonas (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      varchar(10)  NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9_]{2,10}$'),
    nombre      varchar(80)  NOT NULL,
    activa      boolean      NOT NULL DEFAULT true,
    creada_en   timestamptz  NOT NULL DEFAULT now()
);

-- Tipos de servicio que puede elegir el cliente
CREATE TABLE tipos_servicio (
    id                      smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo                  varchar(20)   NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9_]{2,20}$'),
    nombre                  varchar(80)   NOT NULL,
    descripcion             varchar(200)  NOT NULL DEFAULT '',
    tiempo_estimado_horas   smallint      NOT NULL CHECK (tiempo_estimado_horas > 0),
    peso_maximo_kg          numeric(6,2)  NOT NULL CHECK (peso_maximo_kg > 0),
    activo                  boolean       NOT NULL DEFAULT true,
    creado_en               timestamptz   NOT NULL DEFAULT now()
);

-- Outbox: cada cambio de estado de un envío inserta aquí su evento, en la MISMA
-- transacción. El sincronizador (módulo seguimiento) lo copia a MongoDB con
-- _id = id, y marca procesado_en. Los eventos no se borran: permiten reconstruir
-- la colección de eventos si se pierde.
CREATE TABLE outbox (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    secuencia       bigint       GENERATED ALWAYS AS IDENTITY UNIQUE,
    codigo_envio    varchar(12)  NOT NULL CHECK (codigo_envio ~ '^ENV-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
    tipo            varchar(30)  NOT NULL,
    actor           varchar(40)  NOT NULL,
    datos           jsonb        NOT NULL DEFAULT '{}'::jsonb,
    ocurrido_en     timestamptz  NOT NULL DEFAULT now(),
    intentos        integer      NOT NULL DEFAULT 0,
    ultimo_error    text,
    procesado_en    timestamptz
);

-- El sincronizador busca pendientes en orden: índice parcial solo de pendientes
CREATE INDEX outbox_pendientes_idx ON outbox (secuencia) WHERE procesado_en IS NULL;
-- Historial por envío en orden
CREATE INDEX outbox_codigo_envio_idx ON outbox (codigo_envio, secuencia);
