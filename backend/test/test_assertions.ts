import type { Response, TableKey } from '../../shared/src/types/types';
import { getEntityName } from '../src/helpers';
import { fetchFullTable, upsertRow, deleteRow } from './test_helpers';
import assert from 'node:assert';

// List responses return { data, total } (no success/message envelope).
export async function toGetAnEmptyTable(tableName: string) {
  const response = await fetchFullTable(tableName);
  assert.strictEqual(response.status, 200);
  const body = await response.json();
  assert.equal(Array.isArray(body.data), true);
  assert.strictEqual(body.data.length, 0);
}

// POST an object into an empty table and confirm it was stored.
// `expectedInList` may include derived columns (joins) that the list view returns.
export async function insertedToEmptyTableCorrectly(
  tableName: string,
  insertObject: Record<string, unknown>,
  expectedInList: Record<string, unknown> = insertObject
) {
  await toGetAnEmptyTable(tableName);
  const response = await upsertRow(tableName, insertObject, false);
  assert.strictEqual(response.status, 201);
  const body = await response.json();
  assert.deepEqual(body.data, insertObject);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.message, `${getEntityName(tableName as TableKey)} created successfully`);

  const listBody = await (await fetchFullTable(tableName)).json();
  tableOnlyContains(listBody, tableName as TableKey, expectedInList);
}

export async function uniqueInTableDeletedCorrectly(
  tableName: string,
  obj: Record<string, unknown>
) {
  const response = await deleteRow(tableName, obj);
  const body = await response.json();
  assert.strictEqual(response.status, 200);
  operationPerformedSuccesfully(body, tableName as TableKey, obj, 'deleted');
  await toGetAnEmptyTable(tableName);
}

export function operationPerformedSuccesfully(
  body: Response,
  tableName: TableKey,
  affectedElement: Record<string, unknown>,
  operationDone: string
) {
  assert.deepEqual(body.data, affectedElement);
  assert.strictEqual(body.success, true);
  assert.strictEqual(body.message, `${getEntityName(tableName)} ${operationDone} successfully`);
}

export function tableOnlyContains(
  body: Response,
  _tableName: TableKey,
  expectedElement: Record<string, unknown>
) {
  assert.ok(Array.isArray(body.data));
  assert.equal(body.data.length, 1);
  assert.deepEqual(body.data[0], expectedElement);
}
