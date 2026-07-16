-- Development seed data for the comprobantes domain (providers, articles,
-- vouchers and their line items). Not wired to any npm script; run by hand
-- against a migrated database when you want sample rows to look at.
-- comprobantes.total and detalle_comprobante.subtotal are derived, so they are
-- never inserted here.

SET client_encoding = 'UTF8';

-- Clean up existing data (child first to respect foreign keys).
DELETE FROM detalle_comprobante;
DELETE FROM comprobantes;
DELETE FROM articulos;
DELETE FROM proveedores;

INSERT INTO proveedores (cuit, razon_social, email, telefono, direccion, condicion_iva) VALUES
('30-12345678-9', 'Insumos del Sur SA', 'ventas@insumosdelsur.com', '011-4555-1234', 'Av. Siempreviva 742', 'responsable_inscripto'),
('27-98765432-1', 'Distribuidora Norte SRL', 'contacto@distribnorte.com', '011-4777-5678', 'Calle Falsa 123', 'responsable_inscripto'),
('20-11223344-5', 'Servicios Pampa', 'pampa@servicios.com', '0351-555-9090', 'Bv. San Juan 456', 'monotributo');

INSERT INTO articulos (codigo, descripcion, precio_unitario) VALUES
('ART-001', 'Resma de papel A4', 4500.00),
('ART-002', 'Cartucho de tinta negra', 18900.50),
('ART-003', 'Café molido', 7200.00),
('ART-004', 'Hora de soporte técnico', 25000.00);

INSERT INTO comprobantes (numero, tipo, cuit, fecha, estado) VALUES
('FA-0001-00000001', 'factura_a', '30-12345678-9', '2026-05-10', 'pagado'),
('FA-0002-00000015', 'factura_b', '27-98765432-1', '2026-05-22', 'pendiente'),
('FA-0003-00000007', 'factura_c', '20-11223344-5', '2026-06-01', 'pendiente');

INSERT INTO detalle_comprobante (numero, codigo, cantidad) VALUES
('FA-0001-00000001', 'ART-001', 10),
('FA-0001-00000001', 'ART-003', 5),
('FA-0002-00000015', 'ART-002', 2),
('FA-0003-00000007', 'ART-004', 1);
