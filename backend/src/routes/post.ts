import { Pool } from "pg";
import express from 'express';

async function insertStudent(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const { numero_libreta, dni, first_name, last_name, email, enrollment_date, status } = req.body;
    const result = await pool.query(
      'INSERT INTO students (numero_libreta, dni, first_name, last_name, email, enrollment_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [numero_libreta, dni, first_name, last_name, email, enrollment_date, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function insertSubject(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const { cod_mat, name, description, credits, department } = req.body;
    const result = await pool.query(
      'INSERT INTO subjects (cod_mat, name, description, credits, department) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [cod_mat, name, description, credits, department]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function insertEnrollment(req: express.Request, res: express.Response, pool: Pool) {
  try {
    const { numero_libreta, cod_mat, enrollment_date, grade, status } = req.body;
    const result = await pool.query(
      'INSERT INTO enrollments (numero_libreta, cod_mat, enrollment_date, grade, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [numero_libreta, cod_mat, enrollment_date, grade, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {insertStudent, insertSubject, insertEnrollment};