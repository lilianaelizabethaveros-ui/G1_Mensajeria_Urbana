-- 090_semilla_catalogos.sql · Compartido (Liliana)
-- Datos FICTICIOS de demostración. ON CONFLICT hace que sea seguro aunque
-- alguien ya haya creado alguno de estos registros a mano.

INSERT INTO zonas (codigo, nombre) VALUES
    ('NORTE',  'Zona Norte'),
    ('CENTRO', 'Zona Centro'),
    ('SUR',    'Zona Sur'),
    ('VALLE',  'Zona Valle')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO tipos_servicio (codigo, nombre, descripcion, tiempo_estimado_horas, peso_maximo_kg) VALUES
    ('ESTANDAR',   'Estándar',   'Entrega dentro de la ciudad en el día siguiente', 24, 20.00),
    ('EXPRESS',    'Express',    'Entrega prioritaria el mismo día',                 4, 10.00),
    ('DOCUMENTOS', 'Documentos', 'Sobres y documentos livianos',                     8,  2.00)
ON CONFLICT (codigo) DO NOTHING;
