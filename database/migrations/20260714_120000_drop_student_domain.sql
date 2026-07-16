-- El dominio de alumnos (students/subjects/enrollments) fue reemplazado por el
-- de comprobantes y ya no lo declara el SSOT. Se elimina, junto con la FK
-- auth.users -> students que ningún endpoint lee.

SET client_encoding = 'UTF8';

ALTER TABLE auth.users DROP COLUMN IF EXISTS student_numero_libreta;

DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS students;
