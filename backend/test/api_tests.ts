import * as asserts from './test_assertions.ts';
import * as objects from './test_objects';
import { upsertRow, fetchFullTable } from './test_helpers.ts';
import { createAppGivenPool } from '../src/app';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, test } from 'vitest';
import assert from 'node:assert';
import dotenv from 'dotenv';

const TESTS_PORT = 4000;
export const API_BASE = `http://localhost:${TESTS_PORT}/api`;

dotenv.config({ path: '.env.tests' });
let server: any;

const testsPool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

beforeAll(async () => {
  const app = createAppGivenPool(testsPool);
  server = app.listen(TESTS_PORT);
  await clearDatabase();
});

afterEach(async () => await clearDatabase());

afterAll(async () => {
  testsPool.end();
  server.close();
});

/* GET empty tables */

test('GET /proveedores of empty db returns an empty list', async () => {
  try {
    await asserts.toGetAnEmptyTable('proveedores');
  } catch (error) {
    handleError(error);
  }
});

test('GET /articulos of empty db returns an empty list', async () => {
  try {
    await asserts.toGetAnEmptyTable('articulos');
  } catch (error) {
    handleError(error);
  }
});

test('GET /comprobantes of empty db returns an empty list', async () => {
  try {
    await asserts.toGetAnEmptyTable('comprobantes');
  } catch (error) {
    handleError(error);
  }
});

test('GET /detalle_comprobante of empty db returns an empty list', async () => {
  try {
    await asserts.toGetAnEmptyTable('detalle_comprobante');
  } catch (error) {
    handleError(error);
  }
});

/* POST + GET */

test('POST & GET /proveedores inserts a provider', async () => {
  try {
    await asserts.insertedToEmptyTableCorrectly('proveedores', objects.proveedor);
  } catch (error) {
    handleError(error);
  }
});

test('POST & GET /articulos inserts an article', async () => {
  try {
    await asserts.insertedToEmptyTableCorrectly('articulos', objects.articulo);
  } catch (error) {
    handleError(error);
  }
});

test('POST & GET /comprobantes inserts a voucher with derived provider name', async () => {
  try {
    await upsertRow('proveedores', objects.proveedor, false);
    await asserts.insertedToEmptyTableCorrectly(
      'comprobantes',
      objects.comprobante,
      objects.comprobanteExpectedResponse
    );
  } catch (error) {
    handleError(error);
  }
});

test('POST & GET /detalle_comprobante inserts a line item with derived subtotal', async () => {
  try {
    await objects.seedProveedorArticuloComprobante();
    await asserts.insertedToEmptyTableCorrectly(
      'detalle_comprobante',
      objects.detalle,
      objects.detalleExpectedResponse
    );
  } catch (error) {
    handleError(error);
  }
});

/* DELETE */

test('DELETE /proveedores', async () => {
  try {
    await asserts.insertedToEmptyTableCorrectly('proveedores', objects.proveedor);
    await asserts.uniqueInTableDeletedCorrectly('proveedores', objects.proveedor);
  } catch (error) {
    handleError(error);
  }
});

test('DELETE /comprobantes', async () => {
  try {
    await upsertRow('proveedores', objects.proveedor, false);
    await asserts.insertedToEmptyTableCorrectly(
      'comprobantes',
      objects.comprobante,
      objects.comprobanteExpectedResponse
    );
    await asserts.uniqueInTableDeletedCorrectly('comprobantes', objects.comprobante);
  } catch (error) {
    handleError(error);
  }
});

test('DELETE /detalle_comprobante', async () => {
  try {
    await objects.seedProveedorArticuloComprobante();
    await asserts.insertedToEmptyTableCorrectly(
      'detalle_comprobante',
      objects.detalle,
      objects.detalleExpectedResponse
    );
    await asserts.uniqueInTableDeletedCorrectly('detalle_comprobante', objects.detalle);
  } catch (error) {
    handleError(error);
  }
});

/* PUT */

test('PUT /articulos', async () => {
  try {
    await asserts.insertedToEmptyTableCorrectly('articulos', objects.articulo);
    const response = await upsertRow('articulos', objects.articuloModified, true);
    assert.strictEqual(response.status, 202);
    const body = await response.json();
    asserts.operationPerformedSuccesfully(body, 'articulos', objects.articuloModified, 'updated');
    const listBody = await (await fetchFullTable('articulos')).json();
    asserts.tableOnlyContains(listBody, 'articulos', objects.articuloModified);
  } catch (error) {
    handleError(error);
  }
});

test('PUT /comprobantes', async () => {
  try {
    await upsertRow('proveedores', objects.proveedor, false);
    await asserts.insertedToEmptyTableCorrectly(
      'comprobantes',
      objects.comprobante,
      objects.comprobanteExpectedResponse
    );
    const response = await upsertRow('comprobantes', objects.comprobanteModified, true);
    assert.strictEqual(response.status, 202);
    const body = await response.json();
    asserts.operationPerformedSuccesfully(body, 'comprobantes', objects.comprobanteModified, 'updated');
    const listBody = await (await fetchFullTable('comprobantes')).json();
    asserts.tableOnlyContains(listBody, 'comprobantes', objects.comprobanteModifiedExpectedResponse);
  } catch (error) {
    handleError(error);
  }
});

test('PUT /detalle_comprobante', async () => {
  try {
    await objects.seedProveedorArticuloComprobante();
    await asserts.insertedToEmptyTableCorrectly(
      'detalle_comprobante',
      objects.detalle,
      objects.detalleExpectedResponse
    );
    const response = await upsertRow('detalle_comprobante', objects.detalleModified, true);
    assert.strictEqual(response.status, 202);
    const body = await response.json();
    asserts.operationPerformedSuccesfully(body, 'detalle_comprobante', objects.detalleModified, 'updated');
    const listBody = await (await fetchFullTable('detalle_comprobante')).json();
    asserts.tableOnlyContains(listBody, 'detalle_comprobante', objects.detalleModifiedExpectedResponse);
  } catch (error) {
    handleError(error);
  }
});

function handleError(error: unknown) {
  clearDatabase();
  console.log(error);
  throw error;
}

async function clearDatabase() {
  await testsPool.query(
    `TRUNCATE TABLE detalle_comprobante, comprobantes, articulos, proveedores CASCADE`
  );
}
