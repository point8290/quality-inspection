import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { computeSignature, signaturesMatch, timestampIsFresh } from '../lib/signature';

export const SIGNATURE_HEADER = 'x-qit-signature';
export const TIMESTAMP_HEADER = 'x-qit-timestamp';

function reject(reason: string): never {
  // Logged here and nowhere else: a rejected delivery must never reach the event table, or
  // unauthenticated traffic could write to it (DESIGN.md §5.1).
  console.warn(`[sap-webhook] rejected delivery: ${reason}`);
  throw new AppError(401, 'INVALID_SIGNATURE', 'Signature verification failed');
}

/**
 * Gate on the SAP webhook route. Runs against the raw body captured by express.raw(), since
 * re-serialised JSON would not byte-match what SAP signed.
 */
export function verifySapSignature(req: Request, _res: Response, next: NextFunction) {
  const signature = req.header(SIGNATURE_HEADER);
  const timestamp = req.header(TIMESTAMP_HEADER);

  if (!signature || !timestamp) {
    reject('missing signature or timestamp header');
  }

  if (!timestampIsFresh(timestamp, env.sapTimestampToleranceMs)) {
    reject('timestamp outside the replay window');
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const expected = computeSignature(env.sapWebhookSecret, timestamp, rawBody);

  if (!signaturesMatch(expected, signature)) {
    reject('signature mismatch');
  }

  next();
}
