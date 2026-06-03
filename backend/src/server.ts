import express from 'express';
import cors from 'cors';
import path from 'path';
import { pool } from './db';
import { assertSchemaInSync } from './schema-lock';
import { DEFAULT_MIGRATIONS_DIR } from './migration-files';
import { getStudentsHandler, getSubjectsHandler, getEnrollmentsHandler } from './routes/get';
import { updateStudent, updateSubject, updateEnrollment } from './routes/put';
import { insertStudent, insertSubject, insertEnrollment } from './routes/post';
import { deleteStudent, deleteSubject, deleteEnrollment } from './routes/delete';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await assertSchemaInSync(pool, DEFAULT_MIGRATIONS_DIR);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('[schema-lock] health check failed:\n' + (err as Error).message);
    res.status(503).json({ status: 'error' });
  }
});

// Student routes
app.get('/api/students', async (req, res) => getStudentsHandler(req, res, pool));

app.post('/api/students', async (req, res) => insertStudent(req, res, pool));

app.put('/api/students', async (req, res) => updateStudent(req, res, pool));

app.delete('/api/students', async (req, res) => deleteStudent(req, res, pool));

// Subjects routes
app.get('/api/subjects', async (req, res) => getSubjectsHandler(req, res, pool));

app.post('/api/subjects', async (req, res) => insertSubject(req, res, pool));

app.put('/api/subjects', async (req, res) => updateSubject(req, res, pool));

app.delete('/api/subjects', async (req, res) => deleteSubject(req, res, pool));

// Enrollments routes
app.get('/api/enrollments', async (req, res) => getEnrollmentsHandler(req, res, pool));

app.post('/api/enrollments', async (req, res) => insertEnrollment(req, res, pool));

app.put('/api/enrollments', async (req, res) => updateEnrollment(req, res, pool));

app.delete('/api/enrollments', async (req, res) => deleteEnrollment(req, res, pool));

// Serve static files from frontend dist
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all handler: send back index.html for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

async function start(): Promise<void> {
  try {
    await assertSchemaInSync(pool, DEFAULT_MIGRATIONS_DIR);
    console.log('[schema-lock] schema in sync');
  } catch (err) {
    console.error('[schema-lock] startup failed:\n' + (err as Error).message);
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

start();