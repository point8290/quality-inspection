import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 over `${timestamp}.${rawBody}` (DESIGN.md §5.1).
 *
 * The timestamp is *inside* the signed string on purpose. If only the body were signed, the
 * timestamp header would be attacker-controlled: capture one valid delivery, rewrite the
 * header to look fresh, and the replay window it exists to enforce does nothing.
 *
 * The body is the raw bytes as received — re-serialised JSON would not byte-match.
 */
export function computeSignature(secret: string, timestamp: string, rawBody: Buffer) {
  const hmac = createHmac('sha256', secret);
  hmac.update(`${timestamp}.`);
  hmac.update(rawBody);

  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Constant-time compare, so an attacker can't learn the expected signature byte by byte from
 * response timing. Lengths are compared first because timingSafeEqual throws on a mismatch;
 * that leaks only the length, which is fixed for a hex SHA-256 digest anyway.
 */
export function signaturesMatch(expected: string, provided: string) {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(provided, 'utf8');

  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, providedBytes);
}

/** Rejects deliveries whose clock is too far from ours, in either direction. */
export function timestampIsFresh(timestamp: string, toleranceMs: number, now = Date.now()) {
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return false;
  }

  return Math.abs(now - parsed) <= toleranceMs;
}
