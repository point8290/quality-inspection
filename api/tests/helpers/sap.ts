import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../../src/app';

/** Matches the dev/test fallback in src/config/env.ts. */
export const TEST_SECRET = 'dev-secret';

/**
 * The timestamp is part of the signed string, not just a header — so a captured request
 * can't be replayed by rewriting X-QIT-Timestamp (DESIGN.md §5.1).
 */
export function sign(rawBody: string, timestamp: string, secret = TEST_SECRET) {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `sha256=${digest}`;
}

export function sapPayload(overrides: Record<string, unknown> = {}) {
  const { notification, ...rest } = overrides as {
    notification?: Record<string, unknown>;
  };

  return {
    eventId: `evt_${randomUUID()}`,
    occurredAt: '2026-08-01T10:15:00.000Z',
    notification: {
      defectCode: 'Q-HOLE-01',
      severityCode: 'CRITICAL',
      workCenter: 'LOOM-04',
      inspectionDate: '2026-08-01',
      description: 'Warp break detected on inline scan',
      ...notification,
    },
    ...rest,
  };
}

type DeliveryOverrides = {
  timestamp?: string;
  signature?: string;
  rawBody?: string;
  omitSignature?: boolean;
  omitTimestamp?: boolean;
};

/** Delivers a webhook, correctly signed unless a test deliberately breaks one thing. */
export function deliver(payload: unknown, overrides: DeliveryOverrides = {}) {
  const rawBody = overrides.rawBody ?? JSON.stringify(payload);
  const timestamp = overrides.timestamp ?? new Date().toISOString();
  const signature = overrides.signature ?? sign(rawBody, timestamp);

  const pending = request(app).post('/api/sap-webhook').set('Content-Type', 'application/json');

  if (!overrides.omitSignature) {
    pending.set('X-QIT-Signature', signature);
  }
  if (!overrides.omitTimestamp) {
    pending.set('X-QIT-Timestamp', timestamp);
  }

  // Send the exact string so supertest can't re-serialize it and break the signature.
  return pending.send(rawBody);
}
