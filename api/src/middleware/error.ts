import { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

/**
 * The single exit for every failure, so every error response has the same shape
 * (DESIGN.md §4). Anything that isn't a deliberate AppError is a bug: log it in full, but
 * tell the client nothing about our internals.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // express.json() rejects unparseable bodies with a SyntaxError — that's the caller's fault.
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' },
    });
    return;
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
