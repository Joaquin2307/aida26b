-- The comprobante total is now derived from its line items
-- (SUM(cantidad * precio_unitario)), so the stored column is no longer needed.

SET client_encoding = 'UTF8';

ALTER TABLE comprobantes DROP COLUMN total;
