
-- Repartidores y asignaciones activas de envios.
CREATE TABLE repartidores (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo varchar(7) NOT NULL UNIQUE
        CHECK (codigo ~ '^REP-[0-9]{3}$'),
    nombre varchar(80) NOT NULL,
    zona_id smallint NOT NULL REFERENCES zonas(id),
    capacidad_maxima integer NOT NULL
        CHECK (capacidad_maxima > 0),
    activo boolean NOT NULL DEFAULT true,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE asignaciones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_envio varchar(12) NOT NULL
        REFERENCES envios(codigo),
    repartidor_id bigint NOT NULL
        REFERENCES repartidores(id),
    asignada_en timestamptz NOT NULL DEFAULT now(),
    liberada_en timestamptz,
    CONSTRAINT asignaciones_fechas_coherentes
        CHECK (
            liberada_en IS NULL
            OR liberada_en >= asignada_en
        )
);

-- Un envio no puede tener dos asignaciones activas.
CREATE UNIQUE INDEX asignaciones_envio_activo_idx
    ON asignaciones(codigo_envio)
    WHERE liberada_en IS NULL;

-- Facilita calcular la carga actual de cada repartidor.
CREATE INDEX asignaciones_repartidor_activo_idx
    ON asignaciones(repartidor_id)
    WHERE liberada_en IS NULL;
