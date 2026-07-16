import express from 'express';
import { Pool } from 'pg';

import { structure, canRoleDo } from '../../../shared/src/ssot/structure';
import type { TableKey, ColumnDef, Role } from '../../../shared/src/types/types';
import { getPkFields } from '../../../shared/src/utils/utils';

import {
  getEntityName,
  isKnownTable,
  getNotDerivableFields,
  formatTableColumnsForQuery,
} from '../helpers';

import {
  sendSuccessOperationMessage,
  sendDbError,
  sendNotFoundMessage,
  sendInvalidInstanceMessage,
} from '../status_messages';

import { validateFullObject, sendErrorsIfInvalid } from '../validation/validate';

// POST /api/:tableName/with-items   body: { record: {...}, items: [{...}] }
//
// Generic "create a parent row together with its detail rows" endpoint: it
// inserts the parent and every detail row in a single transaction, so a failing
// item rolls everything back and never leaves an orphan parent. It is driven by
// the SSOT `detailOf` relationship, so it works for any parent that has a detail
// table (e.g. comprobantes + detalle_comprobante), not just one hardcoded pair.
export async function postWithItemsHandler(
  req: express.Request,
  res: express.Response,
  pool: Pool
) {
  const parentParam = req.params.tableName;

  if (!isKnownTable(parentParam)) {
    return sendNotFoundMessage(res, parentParam);
  }

  const parentTable = parentParam as TableKey;

  // The detail (child) table is the one declared as `detailOf` this parent.
  const childTable = (Object.keys(structure.tables) as TableKey[]).find(
    (table) => (structure.tables[table] as { detailOf?: string }).detailOf === parentTable
  );

  const body = (req.body ?? {}) as {
    record?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
  };

  const validatedParent = validateFullObject(parentTable, body.record ?? {});
  if (sendErrorsIfInvalid(res, validatedParent)) {
    return;
  }

  const parentData = validatedParent.data as Record<string, unknown>;
  const items = Array.isArray(body.items) ? body.items : [];

  if (!childTable && items.length > 0) {
    return sendInvalidInstanceMessage(res, `${parentTable} has no detail table`);
  }

  // A parent with a detail table is created together with its items; requiring
  // at least one keeps the same rule the frontend enforces on both sides.
  if (childTable && items.length === 0) {
    return sendInvalidInstanceMessage(res, `${parentTable} requires at least one item`);
  }

  // The generic parent-access check (middleware) only covers the parent table.
  // The detail rows belong to the child table, which may declare a stricter
  // `access`, so authorize the child's create action too before inserting items.
  if (childTable && items.length > 0) {
    const role = (req as express.Request & { user?: { role?: Role } }).user?.role;

    if (role && !canRoleDo(role, childTable, 'create')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
  }

  // Validate every item up front; the link field(s) (child columns that
  // reference the parent) are filled from the parent's primary key value(s), so
  // a composite parent key is linked correctly, not just a single-column one.
  const validatedItems: Record<string, unknown>[] = [];

  if (childTable) {
    const childColumns = structure.tables[childTable].columns as Record<string, ColumnDef>;

    const linkAssignments: Record<string, unknown> = {};
    for (const pkField of getPkFields(parentTable)) {
      const linkField =
        Object.keys(childColumns).find(
          (field) =>
            childColumns[field].foreignKey?.table === parentTable &&
            (childColumns[field].foreignKey?.valueField ?? pkField) === pkField
        ) ?? pkField;
      linkAssignments[linkField] = parentData[pkField];
    }

    for (const item of items) {
      const validatedItem = validateFullObject(childTable, {
        ...item,
        ...linkAssignments,
      });
      if (sendErrorsIfInvalid(res, validatedItem)) {
        return;
      }
      validatedItems.push(validatedItem.data as Record<string, unknown>);
    }
  }

  const parentFields = getNotDerivableFields(parentTable);
  const [parentCols, parentParams] = formatTableColumnsForQuery(parentFields);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const parentResult = await client.query(
      `INSERT INTO ${parentTable} ${parentCols} VALUES ${parentParams} RETURNING *`,
      parentFields.map((field) => parentData[field])
    );

    if (childTable && validatedItems.length > 0) {
      const childFields = getNotDerivableFields(childTable);
      const [childCols, childParams] = formatTableColumnsForQuery(childFields);

      for (const itemData of validatedItems) {
        await client.query(
          `INSERT INTO ${childTable} ${childCols} VALUES ${childParams}`,
          childFields.map((field) => itemData[field])
        );
      }
    }

    await client.query('COMMIT');

    return sendSuccessOperationMessage(
      res,
      getEntityName(parentTable),
      parentResult.rows[0],
      'created',
      201
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return sendDbError(res, error, getEntityName(parentTable));
  } finally {
    client.release();
  }
}
