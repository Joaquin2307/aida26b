-- Comprobantes domain: providers, articles and vouchers.
-- Reuses the generic CRUD layer; tables are surfaced automatically from the SSOT.

SET client_encoding = 'UTF8';

CREATE TABLE proveedores (
    cuit          VARCHAR(13) PRIMARY KEY,
    razon_social  VARCHAR(200) NOT NULL,
    email         VARCHAR(255),
    telefono      VARCHAR(50),
    direccion     VARCHAR(255),
    condicion_iva VARCHAR(50)
);

CREATE TABLE articulos (
    codigo          VARCHAR(50) PRIMARY KEY,
    descripcion     VARCHAR(255) NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    unidad          VARCHAR(50),
    stock           INTEGER
);

CREATE TABLE comprobantes (
    numero VARCHAR(50) PRIMARY KEY,
    tipo   VARCHAR(50) NOT NULL,
    cuit   VARCHAR(13) NOT NULL REFERENCES proveedores(cuit),
    fecha  DATE NOT NULL,
    total  NUMERIC(14,2) NOT NULL,
    estado VARCHAR(50)
);

CREATE INDEX idx_comprobantes_cuit  ON comprobantes(cuit);
CREATE INDEX idx_comprobantes_fecha ON comprobantes(fecha);

-- Sample data so the page has something to show on first load.
INSERT INTO proveedores (cuit, razon_social, email, telefono, direccion, condicion_iva) VALUES
('30-12345678-9', 'Insumos del Sur S.A.', 'ventas@insumosdelsur.com', '011-4555-1234', 'Av. Siempreviva 742', 'responsable_inscripto'),
('27-98765432-1', 'Distribuidora Norte SRL', 'contacto@distribnorte.com', '011-4777-5678', 'Calle Falsa 123', 'responsable_inscripto'),
('20-11223344-5', 'Servicios Pampa', 'pampa@servicios.com', '0351-555-9090', 'Bv. San Juan 456', 'monotributo');

INSERT INTO articulos (codigo, descripcion, precio_unitario, unidad, stock) VALUES
('ART-001', 'Resma de papel A4', 4500.00, 'caja', 120),
('ART-002', 'Cartucho de tinta negra', 18900.50, 'unidad', 35),
('ART-003', 'Café molido', 7200.00, 'kg', 80),
('ART-004', 'Hora de soporte técnico', 25000.00, 'hora', NULL);

INSERT INTO comprobantes (numero, tipo, cuit, fecha, total, estado) VALUES
('FA-0001-00000001', 'factura_a', '30-12345678-9', '2026-05-10', 153000.00, 'pagado'),
('FA-0002-00000015', 'factura_b', '27-98765432-1', '2026-05-22', 89000.50, 'pendiente'),
('RC-0001-00000007', 'recibo', '20-11223344-5', '2026-06-01', 25000.00, 'pendiente');
