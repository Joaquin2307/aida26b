import express from 'express';
import { Pool } from 'pg';

import { structure } from '../../../shared/src/ssot/structure';
import type { TableKey, Response } from '../../../shared/src/types/types';
import { getPkFields } from '../../../shared/src/utils/utils';

import {
  getEntityName,
  getNotDerivableFields,
  tryQuery,
  columnNamesEqualsNumber,
} from '../helpers';

import {
  sendSuccessOperationMessage,
  sendNotFoundMessage,
  sendDbError,
} from '../status_messages';

import {
  validateFullObject,
  validateOnlyPk,
  sendErrorsIfInvalid,
} from '../validation/validate';

export async function putHandler(
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

  const validatedBody = validateFullObject(tableName, req.body);

  if (sendErrorsIfInvalid(res, validatedBody)) {
    return;
  }

  const validatedPk = validateOnlyPk(tableName, req.query);

  if (sendErrorsIfInvalid(res, validatedPk)) {
    return;
  }

  const pkFields = getPkFields(tableName);

  const pkValues = pkFields.map(
    (pkField) => (validatedPk.data as Record<string, unknown>)[pkField]
  );

  const fieldsToUpdate = getNotDerivableFields(tableName).filter(
    (fieldName) => !pkFields.includes(fieldName)
  );

  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({
      success: false,
      message: `No editable fields found for ${entityName}`,
    });
  }

  const newValues = fieldsToUpdate.map(
    (fieldName) => (validatedBody.data as Record<string, unknown>)[fieldName]
  );

  const setArgumentsString = columnNamesEqualsNumber(
    fieldsToUpdate,
    1,
    ', '
  );

  const whereArgumentsString = columnNamesEqualsNumber(
    pkFields,
    fieldsToUpdate.length + 1,
    ' AND '
  );

  const query = `
    UPDATE ${tableName}
    SET ${setArgumentsString}
    WHERE ${whereArgumentsString}
    RETURNING *
  `;

  const result: Response = await tryQuery(pool, query, [
    ...newValues,
    ...pkValues,
  ]);

  if (!result.success) {
    return sendDbError(res, result.data, entityName);
  }

  if (result.data?.rowCount === 0) {
    return sendNotFoundMessage(res, entityName);
  }

  return sendSuccessOperationMessage(
    res,
    entityName,
    result.data.rows[0],
    'updated',
    202
  );
}

function isKnownTable(tableName: string): tableName is TableKey {
  return Object.prototype.hasOwnProperty.call(structure.tables, tableName);
}