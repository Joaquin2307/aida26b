-- articulos.unidad and articulos.stock were created by 20260617_120000 but are
-- not declared in the SSOT, so the generic engine can neither show, validate nor
-- populate them (they would stay NULL through the API). Drop them so the physical
-- schema matches structure.ts. Forward-only: a new migration, not an edit of the
-- original one.

SET client_encoding = 'UTF8';

ALTER TABLE articulos DROP COLUMN IF EXISTS unidad;
ALTER TABLE articulos DROP COLUMN IF EXISTS stock;
