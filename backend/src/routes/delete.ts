import express from 'express';
import { Pool } from 'pg';

import { structure } from '../../../shared/src/ssot/structure';
import type { TableKey, Response } from '../../../shared/src/types/types';
import { getPkFields } from '../../../shared/src/utils/utils';

import {
  sendSuccessOperationMessage,
  sendNotFoundMessage,
  sendDbError,
} from '../status_messages';

import {
  getEntityName,
  tryQuery,
  columnNamesEqualsNumber,
} from '../helpers';

import {
  validateOnlyPk,
  sendErrorsIfInvalid,
} from '../validation/validate';

export async function deleteHandler(
  req: express.Request,
  res: express.Response,
  pool: Pool
) {
  const tableNameParam = req.params.tableName;

  if (!isKnownTable(tableNameParam)) {
    return sendNotFoundMessage(res, tableNameParam);
  }

  const tableName = tableNameParam as TableKey;
  const entityName = getEntityName(tableName);

  const pk = validateOnlyPk(tableName, req.query);

  if (sendErrorsIfInvalid(res, pk)) {
    return;
  }

  const pkFields = getPkFields(tableName);

  const pkValues = pkFields.map(
    (pkField) => (pk.data as Record<string, unknown>)[pkField]
  );

  const whereArgumentsString = columnNamesEqualsNumber(
    pkFields,
    1,
    ' AND '
  );

  const query = `
    DELETE FROM ${tableName}
    WHERE ${whereArgumentsString}
    RETURNING *
  `;

  const queryResponse: Response = await tryQuery(pool, query, pkValues);

  if (!queryResponse.success) {
    return sendDbError(res, queryResponse.data, entityName);
  }

  if (queryResponse.data?.rowCount === 0) {
    return sendNotFoundMessage(res, entityName);
  }

  return sendSuccessOperationMessage(
    res,
    entityName,
    queryResponse.data?.rows?.[0],
    'deleted',
    200
  );
}

function isKnownTable(tableName: string): tableName is TableKey {
  return Object.prototype.hasOwnProperty.call(structure.tables, tableName);
}