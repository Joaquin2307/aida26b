import { Pool } from 'pg';
import cors from 'cors';
import express from 'express';

import { registerApiRoutes } from './routes/register';

// Test-only app factory: the same generic API surface as the real server
// (server.ts), wired through the shared registerApiRoutes so the two never
// drift, but WITHOUT auth/RBAC middleware and WITHOUT static file serving. It
// lets the DB integration tests exercise the CRUD/report/with-items endpoints
// directly. Do not use as a production entrypoint — server.ts is the real one.
export function createAppGivenPool(pool: Pool) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  registerApiRoutes(app, pool);

  return app;
}
