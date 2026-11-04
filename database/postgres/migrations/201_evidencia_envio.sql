-- 201_evidencia_envio.sql · Dominios 3 y 4 (seguimiento y evidencias)
-- Responsable: Liliana Averos (asumió la parte de Juan Fernando, ver D38 en la bitácora).
-- Agrega a la tabla envios (de Liliana) la referencia a la evidencia de entrega guardada
-- en MongoDB. La evidencia es prueba de entrega SOLO si envios.evidencia_id la referencia.
-- No editar después de aplicada: los cambios van en una migración nueva.

ALTER TABLE envios
    ADD COLUMN evidencia_id  uuid UNIQUE,      -- _id del documento en MongoDB "evidencias"
    ADD COLUMN entregado_en  timestamptz;

-- Regla del dominio 4: ningún envío queda ENTREGADO sin evidencia y sin fecha de entrega,
-- y ninguna evidencia queda enlazada a un envío que no esté ENTREGADO.
ALTER TABLE envios
    ADD CONSTRAINT envios_entrega_coherente
        CHECK ((estado = 'ENTREGADO') = (evidencia_id IS NOT NULL AND entregado_en IS NOT NULL));
