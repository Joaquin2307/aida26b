-- Redefine the privilege levels to three roles: admin (everything),
-- administrativo (adds proveedores/articulos/comprobantes, no reports) and
-- contador (reports only). Migrates existing rows editor -> administrativo and
-- reader -> contador, then swaps the CHECK constraint. Forward-only.

ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE auth.users SET role = 'administrativo' WHERE role = 'editor';
UPDATE auth.users SET role = 'contador'       WHERE role = 'reader';

ALTER TABLE auth.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'administrativo', 'contador'));
