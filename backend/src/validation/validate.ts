import type { Response } from 'express';

import { sendInvalidInstanceMessage } from '../status_messages';

// Validation core is shared with the frontend; this module adds the Express-only response helper.
export * from '../../../shared/src/validation/validate';

export function sendErrorsIfInvalid<T>(
  res: Response,
  result: { data: T } | { errors: string[] },
): result is { errors: string[] } {
  if ('errors' in result) {
    // Same { success, data, message } envelope as every other route error.
    sendInvalidInstanceMessage(res, result.errors.join('; '));
    return true;
  }
  return false;
}
