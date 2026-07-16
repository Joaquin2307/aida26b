// @ts-nocheck
import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'vitest';
import { app, pool } from '../src/server';
import { hashPassword } from '../src/auth';
import { canRoleDo, structure } from '../../shared/src/ssot/structure';

class FakeDb {
  constructor(users) {
    this.users = users;
    this.sessions = [];
    this.audit = [];
    this.proveedores = [];
    this.comprobantes = [];
    this.detalle = [];
    // Known articles, used to emulate the FK constraint on detalle_comprobante.
    this.articulos = ['ART-001', 'ART-002', 'ART-003'];
    this.nextUserId = Math.max(...users.map((user) => user.id)) + 1;
  }

  async query(text, params = []) {
    const sql = text.replace(/\s+/g, ' ').trim();

    // Transaction control statements - just acknowledge (handle variants)
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql)) {
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO auth.audit_log')) {
      this.audit.push({ actor_user_id: params[0], event_type: params[1], outcome: params[2] });
      return { rows: [] };
    }
    if (sql.includes('FROM auth.users WHERE username = $1')) {
      return { rows: this.users.filter((user) => user.username === params[0]) };
    }
    if (sql.startsWith('SELECT password_hash, password_salt FROM auth.users WHERE id')) {
      const user = this.users.find((item) => item.id === params[0]);
      return { rows: user ? [{ password_hash: user.password_hash, password_salt: user.password_salt }] : [] };
    }
    if (sql.startsWith('INSERT INTO auth.sessions')) {
      this.sessions.push({ user_id: params[0], token_hash: params[1], expires_at: Date.now() + 604800000 });
      return { rows: [] };
    }
    if (sql.startsWith('SELECT s.id AS session_id')) {
      const session = this.sessions.find((item) => item.token_hash === params[0] && item.expires_at > Date.now());
      const user = session && this.users.find((item) => item.id === session.user_id && item.is_active);
      return { rows: user ? [{ session_id: 1, ...user }] : [] };
    }
    if (sql.startsWith('DELETE FROM auth.sessions WHERE token_hash')) {
      this.sessions = this.sessions.filter((item) => item.token_hash !== params[0]);
      return { rows: [] };
    }
    if (sql.startsWith('DELETE FROM auth.sessions WHERE user_id')) {
      this.sessions = this.sessions.filter((item) => item.user_id !== params[0]);
      return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO auth.users')) {
      if (this.users.some((user) => user.username === params[0])) {
        throw Object.assign(new Error('duplicate username'), { code: '23505' });
      }
      const user = {
        id: this.nextUserId++,
        username: params[0],
        email: params[1],
        password_hash: params[2],
        password_salt: params[3],
        role: sql.includes("'reader'") ? 'reader' : params[4],
        is_active: true,
        must_change_password: true,
      };
      this.users.push(user);
      return { rows: [publicRow(user)] };
    }
    if (sql.startsWith('UPDATE auth.users SET password_hash')) {
      const user = this.users.find((item) => item.id === params[2]);
      if (!user) return { rows: [] };
      user.password_hash = params[0];
      user.password_salt = params[1];
      user.must_change_password = sql.includes('must_change_password = true');
      return { rows: [publicRow(user)] };
    }
    // Generic monthly report aggregation (SELECT ... FROM (base) ...). Matched
    // before the generic proveedores branch below, which also matches a table name.
    // Captures the query so tests can assert on the generated SQL and params.
    if (sql.startsWith('SELECT base.')) {
      this.lastReportQuery = { sql, params };
      return {
        rows: [
          { cuit: '20-11223344-5', proveedor_nombre: 'Servicios Pampa', record_count: 2, total: '15000.00' },
        ],
      };
    }
    if (sql.startsWith('SELECT * FROM proveedores ORDER BY')) {
      return { rows: this.proveedores };
    }

    // Handle queries that wrap the proveedores query in a CTE/derived table or use COUNT
    if (/FROM\s*\(\s*SELECT\s+\*\s+FROM\s+proveedores/i.test(sql) || /FROM\s+proveedores/i.test(sql)) {
      if (/SELECT\s+COUNT\(/i.test(sql)) {
        return { rows: [{ count: this.proveedores.length }] };
      }
      return { rows: this.proveedores };
    }
    if (sql.startsWith('INSERT INTO proveedores')) {
      if (this.proveedores.some((p) => p.cuit === params[0])) {
        throw Object.assign(new Error('unique violation'), {
          code: '23505',
          detail: `Key (cuit)=(${params[0]}) already exists.`,
        });
      }
      const proveedor = {
        cuit: params[0],
        razon_social: params[1],
        email: params[2],
        telefono: params[3],
        direccion: params[4],
        condicion_iva: params[5],
      };
      this.proveedores.push(proveedor);
      return { rows: [proveedor] };
    }
    if (sql.startsWith('INSERT INTO comprobantes')) {
      const comprobante = {
        numero: params[0],
        tipo: params[1],
        cuit: params[2],
        fecha: params[3],
        estado: params[4],
      };
      this.comprobantes.push(comprobante);
      return { rows: [comprobante] };
    }
    if (sql.startsWith('INSERT INTO detalle_comprobante')) {
      if (!this.articulos.includes(params[1])) {
        throw Object.assign(new Error('foreign key violation'), {
          code: '23503',
          detail: `Key (codigo)=(${params[1]}) is not present in table "articulos".`,
        });
      }
      this.detalle.push({ numero: params[0], codigo: params[1], cantidad: params[2] });
      return { rows: [] };
    }

    throw new Error(`Unhandled query: ${sql}`);
  }
}

function publicRow(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    must_change_password: user.must_change_password,
  };
}

async function makeDb() {
  const admin = await hashPassword('adminpass');
  const editor = await hashPassword('editorpass');
  const reader = await hashPassword('readerpass');
  return new FakeDb([
    { id: 1, username: 'admin', email: null, role: 'admin', is_active: true, must_change_password: false, password_hash: admin.passwordHash, password_salt: admin.passwordSalt },
    { id: 2, username: 'editor', email: null, role: 'editor', is_active: true, must_change_password: false, password_hash: editor.passwordHash, password_salt: editor.passwordSalt },
    { id: 3, username: 'reader', email: null, role: 'reader', is_active: true, must_change_password: false, password_hash: reader.passwordHash, password_salt: reader.passwordSalt },
  ]);
}

async function withServer(db, run) {
  pool.query = db.query.bind(db);
  pool.connect = async () => ({
    query: db.query.bind(db),
    release: async () => {},
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(baseUrl, path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get('set-cookie');
  const text = await response.text();
  return { status: response.status, cookie: setCookie ? setCookie.split(';')[0] : null, body: text ? JSON.parse(text) : null };
}

async function login(baseUrl, username, password) {
  const response = await request(baseUrl, '/api/auth/login', { method: 'POST', body: { username, password } });
  assert.equal(response.status, 200);
  assert.ok(response.cookie.startsWith('aida_session='));
  return response.cookie;
}

test('login, me and logout manage the session cookie', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const badLogin = await request(baseUrl, '/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'wrongpass' } });
    assert.equal(badLogin.status, 401);
    assert.equal(db.audit.at(-1).event_type, 'login_failed');

    const cookie = await login(baseUrl, 'admin', 'adminpass');
    const me = await request(baseUrl, '/api/auth/me', { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, 'admin');

    const logout = await request(baseUrl, '/api/auth/logout', { method: 'POST', cookie });
    assert.equal(logout.status, 204);
    const afterLogout = await request(baseUrl, '/api/auth/me', { cookie });
    assert.equal(afterLogout.status, 401);
  });
});

test('reader can read but cannot mutate data', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'reader', 'readerpass');
    assert.equal((await request(baseUrl, '/api/proveedores', { cookie })).status, 200);
    const write = await request(baseUrl, '/api/proveedores', {
      method: 'POST',
      cookie,
      body: { cuit: '20-11111111-1', razon_social: 'Ada Lovelace SA', email: 'ada@example.com', telefono: '111', direccion: 'Calle 1', condicion_iva: 'monotributo' },
    });
    assert.equal(write.status, 403);
    assert.equal(db.audit.at(-1).event_type, 'permission_denied');
  });
});

test('editor can view but cannot create providers, and cannot manage users', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'editor', 'editorpass');

    // Editors may view providers...
    assert.equal((await request(baseUrl, '/api/proveedores', { cookie })).status, 200);

    // ...but only admins can create them.
    const createProveedor = await request(baseUrl, '/api/proveedores', {
      method: 'POST',
      cookie,
      body: { cuit: '27-22222222-2', razon_social: 'Grace Hopper SRL', email: 'grace@example.com', telefono: '222', direccion: 'Calle 2', condicion_iva: 'responsable_inscripto' },
    });
    assert.equal(createProveedor.status, 403);
    assert.equal(db.audit.at(-1).event_type, 'permission_denied');

    const createUser = await request(baseUrl, '/api/admin/users', { method: 'POST', cookie, body: { username: 'other', password: 'otherpass', role: 'reader' } });
    assert.equal(createUser.status, 403);
  });
});

test('admin can create providers', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'admin', 'adminpass');
    const createProveedor = await request(baseUrl, '/api/proveedores', {
      method: 'POST',
      cookie,
      body: { cuit: '27-22222222-2', razon_social: 'Grace Hopper SRL', email: 'grace@example.com', telefono: '222', direccion: 'Calle 2', condicion_iva: 'responsable_inscripto' },
    });
    assert.equal(createProveedor.status, 201);
    assert.equal(db.proveedores.find((p) => p.cuit === '27-22222222-2').razon_social, 'Grace Hopper SRL');
  });
});

test('editor can create a comprobante with its line items', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'editor', 'editorpass');
    const res = await request(baseUrl, '/api/comprobantes/with-items', {
      method: 'POST',
      cookie,
      body: {
        record: {
          numero: 'FA-0001-00000099',
          tipo: 'factura_a',
          cuit: '27-22222222-2',
          fecha: '2026-05-10',
          estado: 'pendiente',
        },
        items: [{ codigo: 'ART-001', cantidad: 2 }],
      },
    });
    assert.equal(res.status, 201);
    assert.equal(db.comprobantes.length, 1);
    assert.equal(db.detalle.length, 1);
  });
});

test('creating a comprobante with an unknown article returns 400', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'editor', 'editorpass');
    const res = await request(baseUrl, '/api/comprobantes/with-items', {
      method: 'POST',
      cookie,
      body: {
        record: {
          numero: 'FA-0001-00000100',
          tipo: 'factura_a',
          cuit: '27-22222222-2',
          fecha: '2026-05-10',
          estado: 'pendiente',
        },
        items: [{ codigo: 'NO-EXISTE', cantidad: 1 }],
      },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('NO-EXISTE'));
  });
});

test('editor cannot edit or delete a comprobante', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'editor', 'editorpass');

    const put = await request(baseUrl, '/api/comprobantes?numero=FA-0001-00000001', {
      method: 'PUT',
      cookie,
      body: { numero: 'FA-0001-00000001', estado: 'pagado' },
    });
    assert.equal(put.status, 403);

    const del = await request(baseUrl, '/api/comprobantes?numero=FA-0001-00000001', {
      method: 'DELETE',
      cookie,
    });
    assert.equal(del.status, 403);
    assert.equal(db.audit.at(-1).event_type, 'permission_denied');
  });
});

test('creating a provider that already exists returns 409', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'admin', 'adminpass');
    const body = {
      cuit: '27-22222222-2',
      razon_social: 'Grace Hopper SRL',
      email: 'grace@example.com',
      telefono: '222',
      direccion: 'Calle 2',
      condicion_iva: 'responsable_inscripto',
    };
    const first = await request(baseUrl, '/api/proveedores', { method: 'POST', cookie, body });
    assert.equal(first.status, 201);

    const second = await request(baseUrl, '/api/proveedores', { method: 'POST', cookie, body });
    assert.equal(second.status, 409);
    assert.ok(second.body.message.includes('already exists'));
  });
});

test('access matrix: editors create vouchers only; admins do everything', () => {
  // Editors can create vouchers and their line items...
  assert.equal(canRoleDo('editor', 'comprobantes', 'create'), true);
  assert.equal(canRoleDo('editor', 'detalle_comprobante', 'create'), true);
  // ...but cannot edit or delete them.
  assert.equal(canRoleDo('editor', 'comprobantes', 'update'), false);
  assert.equal(canRoleDo('editor', 'comprobantes', 'delete'), false);
  // Editors cannot create providers or articles.
  assert.equal(canRoleDo('editor', 'proveedores', 'create'), false);
  assert.equal(canRoleDo('editor', 'articulos', 'create'), false);
  // Everyone can read.
  assert.equal(canRoleDo('reader', 'comprobantes', 'read'), true);
  assert.equal(canRoleDo('editor', 'proveedores', 'read'), true);
  // Readers cannot mutate anything.
  assert.equal(canRoleDo('reader', 'comprobantes', 'create'), false);
  // Admins can do everything on every table.
  for (const t of ['proveedores', 'articulos', 'comprobantes', 'detalle_comprobante']) {
    for (const a of ['read', 'create', 'update', 'delete']) {
      assert.equal(canRoleDo('admin', t, a), true);
    }
  }
});

test('monthly report rejects an invalid month', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'admin', 'adminpass');
    const res = await request(baseUrl, '/api/reports/comprobantes/monthly?year=2026&month=13&groupBy=cuit&dateField=fecha', { cookie });
    assert.equal(res.status, 400);
  });
});

test('monthly report rejects unknown columns', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'admin', 'adminpass');
    const res = await request(baseUrl, '/api/reports/comprobantes/monthly?year=2026&month=5&groupBy=not_a_column&dateField=fecha', { cookie });
    assert.equal(res.status, 400);
  });
});

test('generic monthly report aggregates a table for any authenticated user', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'reader', 'readerpass');
    const res = await request(
      baseUrl,
      '/api/reports/comprobantes/monthly?year=2026&month=5&groupBy=cuit,proveedor_nombre&dateField=fecha&measure=total',
      { cookie }
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data.table, 'comprobantes');
    assert.equal(res.body.data.year, 2026);
    assert.equal(res.body.data.month, 5);
    assert.ok(Array.isArray(res.body.data.rows));
    assert.equal(res.body.data.rows[0].cuit, '20-11223344-5');
    assert.equal(res.body.data.rows[0].total, '15000.00');
  });
});

test('monthly report passes filter_<col> through as an exact-match condition', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'reader', 'readerpass');
    const res = await request(
      baseUrl,
      '/api/reports/comprobantes/monthly?year=2026&month=5&groupBy=estado&dateField=fecha&measure=total&filter_cuit=20-11223344-5',
      { cookie }
    );
    assert.equal(res.status, 200);

    // cuit is a foreign-key column, so the filter must be exact equality (not
    // ILIKE), numbered after the year/month placeholders, with its value bound.
    assert.ok(db.lastReportQuery.sql.includes('"cuit" = $3'));
    assert.deepEqual(db.lastReportQuery.params, [2026, 5, '20-11223344-5']);
  });
});

test('the "estado" view of the monthly report resolves groupBy from the SSOT end-to-end', async () => {
  const report = structure.reports.comprobantes_mensual;
  // The server resolves groupBy/dateField/measure from the declared report/view,
  // so the client only names which report and view it wants.
  const params = new URLSearchParams({
    year: '2026',
    month: '5',
    report: 'comprobantes_mensual',
    view: 'estado',
    [`filter_${report.filters[0]}`]: '20-11223344-5',
  });

  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const cookie = await login(baseUrl, 'reader', 'readerpass');
    const res = await request(baseUrl, `/api/reports/${report.table}/monthly?${params}`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.table, 'comprobantes');
    assert.ok(db.lastReportQuery.sql.includes('GROUP BY base."estado"'));
    assert.ok(db.lastReportQuery.params.includes('20-11223344-5'));
  });
});

test('admin can create users and reset passwords', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const adminCookie = await login(baseUrl, 'admin', 'adminpass');
    const created = await request(baseUrl, '/api/admin/users', { method: 'POST', cookie: adminCookie, body: { username: 'newreader', password: 'firstpass', role: 'reader' } });
    assert.equal(created.status, 201);
    assert.equal(created.body.role, 'reader');

    const reset = await request(baseUrl, `/api/admin/users/${created.body.id}/reset-password`, { method: 'POST', cookie: adminCookie, body: { password: 'secondpass' } });
    assert.equal(reset.status, 200);

    const newCookie = await login(baseUrl, 'newreader', 'secondpass');
    const me = await request(baseUrl, '/api/auth/me', { cookie: newCookie });
    assert.equal(me.body.user.must_change_password, true);
  });
});

test('first login users must change password before using the app', async () => {
  const db = await makeDb();
  await withServer(db, async (baseUrl) => {
    const adminCookie = await login(baseUrl, 'admin', 'adminpass');
    await request(baseUrl, '/api/admin/users', { method: 'POST', cookie: adminCookie, body: { username: 'tempuser', password: 'temppass1', role: 'reader' } });

    const tempCookie = await login(baseUrl, 'tempuser', 'temppass1');
    const blocked = await request(baseUrl, '/api/proveedores', { cookie: tempCookie });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, 'Password change required');

    const changed = await request(baseUrl, '/api/auth/change-password', {
      method: 'POST',
      cookie: tempCookie,
      body: { current_password: 'temppass1', new_password: 'newpass123' },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.must_change_password, false);
    assert.equal((await request(baseUrl, '/api/proveedores', { cookie: tempCookie })).status, 200);
  });
});
