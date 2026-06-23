USE db_aseguradora;

-- ── Asegurados de prueba ───────────────────────────────────────────────────────

-- Asegurado 1: DNI, póliza vigente al 80%
INSERT INTO asegurados (id_asegurado, nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, activo)
VALUES ('ase-0001-0001-0001-000000000001', 'Carlos', 'Mendoza Ríos', 'DNI', '12345678', '1985-03-15', 1);

INSERT INTO polizas (id_poliza, id_asegurado, numero_poliza, plan, porcentaje_cobertura, fecha_inicio, fecha_fin, estado)
VALUES ('pol-0001-0001-0001-000000000001', 'ase-0001-0001-0001-000000000001',
        'POL-2024-001', 'Plan Salud Plus', 80.00, '2024-01-01', '2026-12-31', 'VIGENTE');

-- Asegurado 2: DNI, póliza vigente al 50%
INSERT INTO asegurados (id_asegurado, nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, activo)
VALUES ('ase-0002-0002-0002-000000000002', 'María', 'García Torres', 'DNI', '87654321', '1992-07-22', 1);

INSERT INTO polizas (id_poliza, id_asegurado, numero_poliza, plan, porcentaje_cobertura, fecha_inicio, fecha_fin, estado)
VALUES ('pol-0002-0002-0002-000000000002', 'ase-0002-0002-0002-000000000002',
        'POL-2024-002', 'Plan Básico', 50.00, '2024-06-01', '2026-05-31', 'VIGENTE');

-- Asegurado 3: CE (carné de extranjería), póliza vigente al 100%
INSERT INTO asegurados (id_asegurado, nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, activo)
VALUES ('ase-0003-0003-0003-000000000003', 'Luis', 'Pérez Vargas', 'CE', 'CE123456', '1978-11-30', 1);

INSERT INTO polizas (id_poliza, id_asegurado, numero_poliza, plan, porcentaje_cobertura, fecha_inicio, fecha_fin, estado)
VALUES ('pol-0003-0003-0003-000000000003', 'ase-0003-0003-0003-000000000003',
        'POL-2024-003', 'Plan Premium', 100.00, '2024-01-01', '2027-12-31', 'VIGENTE');

-- Asegurado 4: DNI, póliza VENCIDA (para probar el caso sin cobertura)
INSERT INTO asegurados (id_asegurado, nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, activo)
VALUES ('ase-0004-0004-0004-000000000004', 'Ana', 'López Díaz', 'DNI', '11223344', '2000-01-10', 1);

INSERT INTO polizas (id_poliza, id_asegurado, numero_poliza, plan, porcentaje_cobertura, fecha_inicio, fecha_fin, estado)
VALUES ('pol-0004-0004-0004-000000000004', 'ase-0004-0004-0004-000000000004',
        'POL-2023-004', 'Plan Básico', 50.00, '2023-01-01', '2023-12-31', 'VENCIDA');

-- Asegurado 5: Pasaporte, sin póliza (para probar el caso NO_ENCONTRADO)
INSERT INTO asegurados (id_asegurado, nombre, apellido, tipo_documento, numero_documento, fecha_nacimiento, activo)
VALUES ('ase-0005-0005-0005-000000000005', 'John', 'Smith Walker', 'PASAPORTE', 'US9988776', '1988-05-20', 1);
