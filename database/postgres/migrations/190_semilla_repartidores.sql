-- Repartidores ficticios para pruebas y demostraciones.

INSERT INTO repartidores
    (codigo, nombre, zona_id, capacidad_maxima)
VALUES
    ('REP-001', 'Ana Torres', 
        (SELECT id FROM zonas WHERE codigo = 'NORTE'), 3),
    ('REP-002', 'Luis Mendoza',
        (SELECT id FROM zonas WHERE codigo = 'NORTE'), 2),
    ('REP-003', 'Maria Lopez',
        (SELECT id FROM zonas WHERE codigo = 'CENTRO'), 4),
    ('REP-004', 'Carlos Vega',
        (SELECT id FROM zonas WHERE codigo = 'SUR'), 2),
    ('REP-005', 'Sofia Ruiz',
        (SELECT id FROM zonas WHERE codigo = 'VALLE'), 3),
    ('REP-006', 'Pedro Castro',
        (SELECT id FROM zonas WHERE codigo = 'CENTRO'), 1)
ON CONFLICT (codigo) DO NOTHING;
