import express from 'express';

/*Messages*/
function sendErrorMessage(res: express.Response, responseMessage: string){
  return res.status(500).json({success: false, data: undefined, message: responseMessage})
}

function sendSuccessOperationMessage(res: express.Response, entityName: string, data: any, operationDone: string, successCode: number){
  return res.status(successCode).json({success: true, data: data, message: `${entityName} ${operationDone} successfully`});
}

function sendInvalidInstanceMessage(res: express.Response, message: string){
  res.status(400).json({success: false, data: undefined, message: message});
}
function sendNotFoundMessage(res: express.Response, message: string){
  res.status(404).json({success: false, data: undefined, message: message});
}

// Maps PostgreSQL constraint-violation errors to meaningful HTTP responses so
// clients get a 4xx with a useful message instead of a generic 500. Anything
// unrecognized falls back to 500 (and is logged) so we never leak internals.
function sendDbError(res: express.Response, error: unknown, entityName: string){
  const pgError = error as { code?: string; detail?: string; column?: string };
  const detail = pgError.detail ?? '';
  // PG detail looks like: Key (column)=(value) is not present / already exists.
  const match = /\(([^)]+)\)=\(([^)]+)\)/.exec(detail);
  const column = match?.[1];
  const value = match?.[2];

  switch (pgError.code) {
    case '23505': // unique_violation: a record with this key already exists
      return res.status(409).json({
        success: false,
        data: undefined,
        message: column
          ? `${entityName} with ${column} "${value}" already exists`
          : `${entityName} already exists`,
      });
    case '23503': // foreign_key_violation
      if (detail.includes('still referenced')) {
        // Deleting a row that other records point to.
        return res.status(409).json({
          success: false,
          data: undefined,
          message: `Cannot delete ${entityName}: it is still referenced by other records`,
        });
      }
      // Inserting/updating a reference that does not exist.
      return res.status(400).json({
        success: false,
        data: undefined,
        message: column
          ? `Invalid reference: ${column} "${value}" does not exist`
          : 'A referenced record does not exist',
      });
    case '23514': // check_violation
      return res.status(400).json({
        success: false,
        data: undefined,
        message: 'A value violates a database constraint',
      });
    case '23502': // not_null_violation
      return res.status(400).json({
        success: false,
        data: undefined,
        message: pgError.column
          ? `Field "${pgError.column}" is required`
          : 'A required field is missing',
      });
    default:
      console.error(error);
      return res.status(500).json({
        success: false,
        data: undefined,
        message: 'Internal server error',
      });
  }
}

export{ sendErrorMessage, sendInvalidInstanceMessage, sendNotFoundMessage, sendSuccessOperationMessage, sendDbError }