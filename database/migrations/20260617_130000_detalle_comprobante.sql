-- Voucher line items: a comprobante can contain many articulos (1 -> N).
-- Mirrors the enrollments join-table pattern; surfaced automatically from the SSOT.

SET client_encoding = 'UTF8';

CREATE TABLE detalle_comprobante (
    numero   VARCHAR(50) NOT NULL REFERENCES comprobantes(numero) ON DELETE CASCADE,
    codigo   VARCHAR(50) NOT NULL REFERENCES articulos(codigo),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (numero, codigo)
);

CREATE INDEX idx_detalle_comprobante_codigo ON detalle_comprobante(codigo);

-- Sample line items for the seeded comprobantes.
INSERT INTO detalle_comprobante (numero, codigo, cantidad) VALUES
('FA-0001-00000001', 'ART-001', 2),
('FA-0001-00000001', 'ART-003', 5),
('FA-0002-00000015', 'ART-002', 1),
('RC-0001-00000007', 'ART-004', 1);
