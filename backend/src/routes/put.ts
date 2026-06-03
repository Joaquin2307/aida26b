import { Pool } from "pg";
import express from 'express';

async function updateStudent(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pksValues          = Object.values(req.query) as any[];
    const { dni, first_name, last_name, email, enrollment_date, status } = req.body;
    const result = await pool.query(
      'UPDATE students SET dni = $1, first_name = $2, last_name = $3, email = $4, enrollment_date = $5, status = $6 WHERE numero_libreta = $7 RETURNING *',
      [dni, first_name, last_name, email, enrollment_date, status].concat(pksValues));
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function updateSubject(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pksValues          = Object.values(req.query) as any[];
    const { cod_mat } = req.params;
    const { name, description, credits, department } = req.body;
    const result = await pool.query(
      'UPDATE subjects SET name = $1, description = $2, credits = $3, department = $4 WHERE cod_mat = $5 RETURNING *',
      [name, description, credits, department].concat(pksValues));
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function updateEnrollment(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pksValues          = Object.values(req.query) as any[];
    const { enrollment_date, grade, status } = req.body;
    const result = await pool.query(
      'UPDATE enrollments SET enrollment_date = $1, grade = $2, status = $3 WHERE numero_libreta = $4 AND cod_mat = $5 RETURNING *',
      [enrollment_date, grade, status].concat(pksValues));
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {updateStudent, updateSubject, updateEnrollment};