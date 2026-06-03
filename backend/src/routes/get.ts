import { Pool } from "pg";
import express from 'express';

async function fetchStudentsTable(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY numero_libreta');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getStudentsHandler(req: express.Request, res: express.Response, pool: Pool) {
  if (Object.values(req.query).length === 0){
    fetchStudentsTable(req, res, pool);
  }
  else{
    fetchStudent(req, res, pool);
  }
}

async function fetchStudent(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pksValues          = Object.values(req.query) as any[];
    const result = await pool.query('SELECT * FROM students WHERE numero_libreta = $1', pksValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function fetchSubjectsTable(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const result = await pool.query('SELECT * FROM subjects ORDER BY cod_mat');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getSubjectsHandler(req: express.Request, res: express.Response, pool: Pool) {
  if (Object.values(req.query).length === 0){
    fetchSubjectsTable(req, res, pool);
  }
  else{
    fetchSubject(req, res, pool);
  }
}


async function fetchSubject (req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pksValues          = Object.values(req.query) as any[];
    const result = await pool.query('SELECT * FROM subjects WHERE cod_mat = $1', pksValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function fetchEnrollmentsTable(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const result = await pool.query(`
      SELECT e.*, s.first_name, s.last_name, sub.name as subject_name
      FROM enrollments e
      JOIN students s ON e.numero_libreta = s.numero_libreta
      JOIN subjects sub ON e.cod_mat = sub.cod_mat
      ORDER BY e.numero_libreta, e.cod_mat
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function getEnrollmentsHandler(req: express.Request, res: express.Response, pool: Pool) {
  if (Object.values(req.query).length === 0){
    fetchEnrollmentsTable(req, res, pool);
  }
  else{
    fetchEnrollment(req, res, pool);
  }
}

async function fetchEnrollment(req: express.Request, res: express.Response, pool: Pool)  {
  try {
    const pksValues          = Object.values(req.query) as any[];
    const result = await pool.query('SELECT * FROM enrollments WHERE numero_libreta = $1 AND cod_mat = $2', pksValues);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching enrollment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export {getStudentsHandler, getSubjectsHandler, getEnrollmentsHandler};