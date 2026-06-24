import express from 'express';
import { Pool } from 'pg';

import { structure } from '../../../shared/src/ssot/structure';
import type { TableKey } from '../../../shared/src/types/types';

import {
  getEntityName,
  getNotDerivableFields,
  formatTableColumnsForQuery,
} from '../helpers';

import {
  sendSuccessOperationMessage,
  sendDbError,
} from '../status_messages';

import { validateFullObject, sendErrorsIfInvalid } from '../validation/validate';

const HEADER_TABLE: TableKey = 'comprobantes';
const ITEM_TABLE: TableKey = 'detalle_comprobante';

// Creates a comprobante together with its line items atomically: the header and
// every detalle row are inserted inside a single transaction, so a failing item
// rolls the whole thing back and never leaves an orphan header. This replaces
// the previous client-side "create header, then post items, then delete on
// failure" flow, which broke for editors (who may create comprobantes but are
// not allowed to delete them, so the rollback DELETE returned 403).
export async function postComprobanteWithItemsHandler(
  req: express.Request,
  res: express.Response,
  pool: Pool
) {
  const body = (req.body ?? {}) as {
    comprobante?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
  };

  // Primary key of the header is the field each line item links back to.
  const linkField = String(structure.tables[HEADER_TABLE].pk);

  const validatedHeader = validateFullObject(HEADER_TABLE, body.comprobante ?? {});
  if (sendErrorsIfInvalid(res, validatedHeader)) {
    return;
  }

  const headerData = validatedHeader.data as Record<string, unknown>;
  const linkValue = headerData[linkField];

  const items = Array.isArray(body.items) ? body.items : [];

  // Validate every item up front; the link field is taken from the header.
  const validatedItems: Record<string, unknown>[] = [];
  for (const item of items) {
    const validatedItem = validateFullObject(ITEM_TABLE, {
      ...item,
      [linkField]: linkValue,
    });
    if (sendErrorsIfInvalid(res, validatedItem)) {
      return;
    }
    validatedItems.push(validatedItem.data as Record<string, unknown>);
  }

  const headerFields = getNotDerivableFields(HEADER_TABLE);
  const [headerCols, headerParams] = formatTableColumnsForQuery(headerFields);

  const itemFields = getNotDerivableFields(ITEM_TABLE);
  const [itemCols, itemParams] = formatTableColumnsForQuery(itemFields);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const headerResult = await client.query(
      `INSERT INTO ${HEADER_TABLE} ${headerCols} VALUES ${headerParams} RETURNING *`,
      headerFields.map((field) => headerData[field])
    );

    for (const itemData of validatedItems) {
      await client.query(
        `INSERT INTO ${ITEM_TABLE} ${itemCols} VALUES ${itemParams}`,
        itemFields.map((field) => itemData[field])
      );
    }

    await client.query('COMMIT');

    return sendSuccessOperationMessage(
      res,
      getEntityName(HEADER_TABLE),
      headerResult.rows[0],
      'created',
      201
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Maps FK/unique/etc. violations to the right 4xx (e.g. a bad cuit or an
    // unknown article codigo → 400 with the offending column/value).
    return sendDbError(res, error, getEntityName(HEADER_TABLE));
  } finally {
    client.release();
  }
}
