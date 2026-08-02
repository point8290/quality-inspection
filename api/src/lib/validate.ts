import { ZodType } from 'zod';
import { validationError } from './errors';

/**
 * Parses at the edge and converts a Zod failure into our 400 envelope. Every issue becomes
 * one `{ path, message }`, so the client can highlight the offending field.
 */
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw validationError(
      'Request validation failed',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return result.data;
}
