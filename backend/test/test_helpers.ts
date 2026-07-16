import { API_BASE } from './api_tests';
import { getPkFields } from '../../shared/src/utils/utils';
import type { TableKey } from '../../shared/src/types/types';

/* Generic CRUD helpers (everything is driven by the SSOT, so one set works for every table). */

type PkPairs = [string, string][];

function queryString(pairs: PkPairs): string {
  return new URLSearchParams(pairs).toString();
}

export function pkOf(tableName: string, obj: Record<string, unknown>): PkPairs {
  // Primary key fields come from the SSOT, so tests never re-declare them.
  return getPkFields(tableName as TableKey).map((field) => [field, String(obj[field])]);
}

export async function fetchFullTable(tableName: string) {
  try {
    return await fetch(`${API_BASE}/${tableName}`);
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function fetchRow(tableName: string, obj: Record<string, unknown>) {
  try {
    return await fetch(`${API_BASE}/${tableName}?` + queryString(pkOf(tableName, obj)));
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function upsertRow(
  tableName: string,
  body: Record<string, unknown>,
  isEdit: boolean
) {
  try {
    return await fetch(`${API_BASE}/${tableName}?` + queryString(pkOf(tableName, body)), {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function deleteRow(tableName: string, obj: Record<string, unknown>) {
  try {
    return await fetch(`${API_BASE}/${tableName}?` + queryString(pkOf(tableName, obj)), {
      method: 'DELETE',
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}
