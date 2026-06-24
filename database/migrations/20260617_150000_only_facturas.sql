-- Comprobantes are now invoices only. Normalize any previously seeded
-- non-invoice types (recibo / notas) to a factura.

SET client_encoding = 'UTF8';

UPDATE comprobantes
SET tipo = 'factura_b'
WHERE tipo NOT IN ('factura_a', 'factura_b', 'factura_c');
