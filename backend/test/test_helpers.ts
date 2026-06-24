import { API_BASE } from './api_tests';

/* Generic CRUD helpers (everything is driven by the SSOT, so one set works for every table). */

type PkPairs = [string, string][];

function queryString(pairs: PkPairs): string {
  return new URLSearchParams(pairs).toString();
}

const PK_FIELDS: Record<string, string[]> = {
  proveedores: ['cuit'],
  articulos: ['codigo'],
  comprobantes: ['numero'],
  detalle_comprobante: ['numero', 'codigo'],
};

export function pkOf(tableName: string, obj: Record<string, unknown>): PkPairs {
  return PK_FIELDS[tableName].map((field) => [field, String(obj[field])]);
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
