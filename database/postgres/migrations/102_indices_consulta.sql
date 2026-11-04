-- Dominio 5: índices para la consulta operativa.
-- PostgreSQL conserva los datos oficiales de los envíos.
-- Los índices mejoran las búsquedas sin duplicar información.

-- Acelera la búsqueda por zona de destino y fecha.
CREATE INDEX IF NOT EXISTS idx_envios_consulta_zona_fecha
ON envios (destino_zona_id, creado_en DESC);

-- Acelera los filtros por estado y fecha.
-- Complementa el índice ya existente en la tabla envios.
CREATE INDEX IF NOT EXISTS idx_envios_consulta_estado_fecha
ON envios (estado, creado_en DESC);

-- Acelera los filtros por rango de fechas.
CREATE INDEX IF NOT EXISTS idx_envios_consulta_fecha
ON envios (creado_en DESC);

-- Facilita ordenar los resultados por fecha y código.
CREATE INDEX IF NOT EXISTS idx_envios_consulta_orden
ON envios (creado_en DESC, codigo DESC);
