import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { Inspection, WebhookEvent } from '../src/models';
import { closeDb, resetMutableTables } from './helpers/db';
import { deliver, sapPayload, sign } from './helpers/sap';

beforeEach(resetMutableTables);
afterAll(closeDb);

const FIVE_MINUTES = 5 * 60 * 1000;

async function countInspections() {
  return Inspection.count();
}

async function countEvents() {
  return WebhookEvent.count();
}

describe('POST /api/sap-webhook — trust', () => {
  it('accepts a correctly signed delivery', async () => {
    const response = await deliver(sapPayload());

    expect(response.status).toBe(201);
    expect(response.body.data.source).toBe('SAP');
  });

  it('rejects a bad signature without writing anything', async () => {
    const response = await deliver(sapPayload(), { signature: 'sha256=deadbeef' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    // 401s are application-logged only, so unauthenticated traffic can't write to the
    // event table (DESIGN.md §5.1).
    expect(await countInspections()).toBe(0);
    expect(await countEvents()).toBe(0);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    const payload = sapPayload();
    const rawBody = JSON.stringify(payload);
    const timestamp = new Date().toISOString();

    const response = await deliver(payload, {
      rawBody,
      timestamp,
      signature: sign(rawBody, timestamp, 'not-our-secret'),
    });

    expect(response.status).toBe(401);
  });

  it('rejects a missing signature header', async () => {
    const response = await deliver(sapPayload(), { omitSignature: true });

    expect(response.status).toBe(401);
    expect(await countEvents()).toBe(0);
  });

  it('rejects a missing timestamp header', async () => {
    const response = await deliver(sapPayload(), { omitTimestamp: true });

    expect(response.status).toBe(401);
  });

  it('rejects a stale timestamp', async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const response = await deliver(sapPayload(), { timestamp: tenMinutesAgo });

    expect(response.status).toBe(401);
  });

  it('rejects a timestamp far in the future', async () => {
    const tenMinutesAhead = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const response = await deliver(sapPayload(), { timestamp: tenMinutesAhead });

    expect(response.status).toBe(401);
  });

  it('rejects a replay whose timestamp was rewritten to look fresh', async () => {
    // THE test for the §5.1 fix. An attacker captures a valid delivery, then rewrites the
    // timestamp header to escape the replay window. Because the timestamp is inside the
    // signed string, the captured signature no longer verifies.
    const payload = sapPayload();
    const rawBody = JSON.stringify(payload);
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const capturedSignature = sign(rawBody, staleTimestamp);

    const response = await deliver(payload, {
      rawBody,
      timestamp: new Date().toISOString(),
      signature: capturedSignature,
    });

    expect(response.status).toBe(401);
    expect(await countInspections()).toBe(0);
  });

  it('accepts a timestamp at the edge of the tolerance window', async () => {
    const nearlyStale = new Date(Date.now() - (FIVE_MINUTES - 30_000)).toISOString();

    const response = await deliver(sapPayload(), { timestamp: nearlyStale });

    expect(response.status).toBe(201);
  });
});

describe('POST /api/sap-webhook — payload validation', () => {
  it('rejects a body that is not JSON', async () => {
    const response = await deliver(null, { rawBody: 'this is not json' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await countEvents()).toBe(0);
  });

  it('rejects a payload with no eventId', async () => {
    const payload = sapPayload() as Record<string, unknown>;
    delete payload.eventId;

    const response = await deliver(payload);

    expect(response.status).toBe(400);
    expect(await countEvents()).toBe(0);
  });

  it('rejects a payload missing notification fields', async () => {
    const response = await deliver(sapPayload({ notification: { workCenter: undefined } }));

    expect(response.status).toBe(400);
  });

  it('rejects a malformed inspectionDate', async () => {
    const response = await deliver(sapPayload({ notification: { inspectionDate: '01-08-2026' } }));

    expect(response.status).toBe(400);
  });

  it('rejects an unknown severity code, and logs no event', async () => {
    // Severity is a fixed interface contract that drives triage and the summary, so a
    // guessed value would be silent data corruption. 4xx also tells a well-behaved SAP
    // "fix your integration" rather than retrying forever.
    const response = await deliver(sapPayload({ notification: { severityCode: 'SEV1' } }));

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'notification.severityCode' })]),
    );
    expect(await countEvents()).toBe(0);
  });
});

describe('POST /api/sap-webhook — idempotency', () => {
  it('does not create a second inspection when SAP redelivers an event', async () => {
    const payload = sapPayload();

    const first = await deliver(payload);
    const second = await deliver(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await countInspections()).toBe(1);
    expect(await countEvents()).toBe(1);
  });

  it('returns the originally created inspection on a redelivery', async () => {
    const payload = sapPayload();

    const first = await deliver(payload);
    const second = await deliver(payload);

    expect(second.body.data.id).toBe(first.body.data.id);
  });

  it('counts redeliveries, so "SAP retried 3 times" is observable', async () => {
    const payload = sapPayload();

    await deliver(payload);
    await deliver(payload);
    await deliver(payload);

    const event = await WebhookEvent.findOne({ where: { eventId: payload.eventId } });
    expect(event?.deliveryCount).toBe(3);
  });

  it('keeps separate events separate', async () => {
    await deliver(sapPayload());
    await deliver(sapPayload());

    expect(await countInspections()).toBe(2);
    expect(await countEvents()).toBe(2);
  });
});

describe('POST /api/sap-webhook — mapping', () => {
  it('maps a known SAP defect code through the reference table', async () => {
    const response = await deliver(sapPayload({ notification: { defectCode: 'Q-STAIN-01' } }));

    expect(response.body.data.defectType.code).toBe('STAIN');
  });

  it('accepts an unknown defect code as OTHER and preserves the raw code', async () => {
    // SAP's defect catalogue is large and changes without telling us. Rejecting would
    // strand legitimate events and make SAP retry a payload we will never accept.
    const response = await deliver(
      sapPayload({ notification: { defectCode: 'Q-BRAND-NEW-99', description: 'Odd texture' } }),
    );

    expect(response.status).toBe(201);
    expect(response.body.data.defectType.code).toBe('OTHER');
    expect(response.body.data.remarks).toContain('Q-BRAND-NEW-99');
    expect(response.body.data.remarks).toContain('Odd texture');
  });

  it('records provenance on the created inspection', async () => {
    const payload = sapPayload();

    const response = await deliver(payload);
    const stored = await Inspection.findByPk(response.body.data.id);

    expect(response.body.data.source).toBe('SAP');
    expect(response.body.data.status).toBe('OPEN');
    expect(stored?.externalRef).toBe(payload.eventId);
  });

  it('maps the notification onto our fields', async () => {
    const response = await deliver(
      sapPayload({ notification: { workCenter: 'DYE-07', inspectionDate: '2026-07-04' } }),
    );

    expect(response.body.data.machineId).toBe('DYE-07');
    expect(response.body.data.inspectionDate).toBe('2026-07-04');
  });

  it('produces an ordinary inspection that the rest of the API can work with', async () => {
    const created = await deliver(sapPayload());
    const id = created.body.data.id;

    const listed = await request(app).get('/api/inspections');
    const resolved = await request(app)
      .patch(`/api/inspections/${id}/resolve`)
      .send({ resolutionNote: 'Handled on the floor' });

    expect(listed.body.data.map((row: { id: string }) => row.id)).toContain(id);
    expect(resolved.status).toBe(200);
  });
});

describe('POST /api/sap-webhook — the dead letter self-heals', () => {
  it('re-attempts a redelivered event that previously failed', async () => {
    const payload = sapPayload();

    // A prior attempt died after logging the event but before creating the inspection.
    await WebhookEvent.create({
      eventId: payload.eventId,
      source: 'SAP',
      payload: JSON.stringify(payload),
      status: 'FAILED',
      error: 'database went away mid-transaction',
    });

    const response = await deliver(payload);

    expect(response.status).toBe(201);
    expect(await countInspections()).toBe(1);

    const event = await WebhookEvent.findOne({ where: { eventId: payload.eventId } });
    expect(event?.status).toBe('PROCESSED');
    expect(event?.inspectionId).toBe(response.body.data.id);
    expect(event?.deliveryCount).toBe(2);
  });

  it('re-attempts an event stuck in RECEIVED', async () => {
    const payload = sapPayload();

    await WebhookEvent.create({
      eventId: payload.eventId,
      source: 'SAP',
      payload: JSON.stringify(payload),
      status: 'RECEIVED',
    });

    const response = await deliver(payload);

    expect(response.status).toBe(201);
    expect(await countInspections()).toBe(1);

    const event = await WebhookEvent.findOne({ where: { eventId: payload.eventId } });
    expect(event?.status).toBe('PROCESSED');
  });
});
