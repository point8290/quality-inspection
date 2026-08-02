/** The closed set of error codes the client branches on (DESIGN.md §4). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ALREADY_RESOLVED'
  | 'INVALID_SIGNATURE'
  | 'INTERNAL_ERROR';

export type ErrorDetail = {
  path: string;
  message: string;
};

/**
 * One error class for every expected failure. Services throw it, the error middleware turns
 * it into the `{ error: { code, message, details? } }` envelope — so no route ever builds an
 * error response by hand.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function validationError(message: string, details: ErrorDetail[]) {
  return new AppError(400, 'VALIDATION_ERROR', message, details);
}

export function notFoundError(message: string) {
  return new AppError(404, 'NOT_FOUND', message);
}
