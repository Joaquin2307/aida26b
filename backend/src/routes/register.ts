import type { Express, RequestHandler } from 'express';
import { Pool } from 'pg';

import type { TableAction } from '../../../shared/src/types/types';

import { getHandler } from './get';
import { putHandler } from './put';
import { postHandler } from './post';
import { deleteHandler } from './delete';
import { postWithItemsHandler } from './with_items';
import { getMonthlyReportHandler } from './report';

// Per-action guard middlewares to run before a generic route. server.ts passes
// auth + RBAC here; the (auth-free) test app passes none. Either way the route
// wiring itself lives in one place, so the two apps can never drift apart.
export type ApiGuard = (action: TableAction) => RequestHandler[];

const noGuard: ApiGuard = () => [];

// Registers the SSOT-driven generic API surface on `app`. Adding a table adds no
// routes; adding a route here adds it for every app that calls this function.
export function registerApiRoutes(app: Express, pool: Pool, guard: ApiGuard = noGuard) {
  // Compound endpoint: create a parent row and its detail rows atomically. The
  // parent-table access is checked here; the child-table access is checked
  // inside the handler (the child may be more restrictive than its parent).
  app.post('/api/:tableName/with-items', ...guard('create'), (req, res) =>
    postWithItemsHandler(req, res, pool)
  );

  // Generic monthly report aggregation over any SSOT table.
  app.get('/api/reports/:tableName/monthly', ...guard('read'), (req, res) =>
    getMonthlyReportHandler(req, res, pool)
  );

  // Generic CRUD, one handler per operation, driven entirely by the SSOT.
  app.get('/api/:tableName', ...guard('read'), (req, res) => getHandler(req, res, pool));
  app.post('/api/:tableName', ...guard('create'), (req, res) => postHandler(req, res, pool));
  app.put('/api/:tableName', ...guard('update'), (req, res) => putHandler(req, res, pool));
  app.delete('/api/:tableName', ...guard('delete'), (req, res) => deleteHandler(req, res, pool));
}
