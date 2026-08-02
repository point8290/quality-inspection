import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

type SeverityCounts = { OPEN: number; RESOLVED: number };

async function create(severityCode: string) {
  const response = await request(app)
    .post('/api/inspections')
    .send(validCreateBody({ severityCode }));
  return response.body.data.id as string;
}

async function createResolved(severityCode: string) {
  const id = await create(severityCode);
  await request(app).patch(`/api/inspections/${id}/resolve`).send({ resolutionNote: 'Fixed' });
  return id;
}

/** 2 open CRITICAL, 1 open MAJOR, 1 resolved MAJOR, 1 open MINOR — 5 in total. */
async function seedKnownMix() {
  await create('CRITICAL');
  await create('CRITICAL');
  await create('MAJOR');
  await createResolved('MAJOR');
  await create('MINOR');
}

describe('GET /api/inspections/summary', () => {
  it('is not swallowed by the /:id route', async () => {
    // Regression guard: registered after /:id, "summary" is read as a malformed UUID.
    const response = await request(app).get('/api/inspections/summary');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('total');
  });

  it('counts open and resolved per severity', async () => {
    await seedKnownMix();

    const { data } = (await request(app).get('/api/inspections/summary')).body;

    expect(data.total).toBe(5);
    expect(data.byStatus).toEqual({ OPEN: 4, RESOLVED: 1 });
    expect(data.bySeverity.CRITICAL).toEqual({ OPEN: 2, RESOLVED: 0 });
    expect(data.bySeverity.MAJOR).toEqual({ OPEN: 1, RESOLVED: 1 });
    expect(data.bySeverity.MINOR).toEqual({ OPEN: 1, RESOLVED: 0 });
  });

  it('has counts that sum to the total, every way you add them up', async () => {
    await seedKnownMix();

    const { data } = (await request(app).get('/api/inspections/summary')).body;
    const severityCounts = Object.values(data.bySeverity) as SeverityCounts[];

    const acrossSeverities = severityCounts.reduce(
      (sum, counts) => sum + counts.OPEN + counts.RESOLVED,
      0,
    );
    const acrossStatuses = data.byStatus.OPEN + data.byStatus.RESOLVED;
    const openAcrossSeverities = severityCounts.reduce((sum, counts) => sum + counts.OPEN, 0);

    expect(acrossSeverities).toBe(data.total);
    expect(acrossStatuses).toBe(data.total);
    expect(openAcrossSeverities).toBe(data.byStatus.OPEN);
  });

  it('moves exactly one inspection from open to resolved when one is resolved', async () => {
    await create('CRITICAL');
    const id = await create('CRITICAL');

    const before = (await request(app).get('/api/inspections/summary')).body.data;
    await request(app).patch(`/api/inspections/${id}/resolve`).send({ resolutionNote: 'Fixed' });
    const after = (await request(app).get('/api/inspections/summary')).body.data;

    expect(before.bySeverity.CRITICAL).toEqual({ OPEN: 2, RESOLVED: 0 });
    expect(after.bySeverity.CRITICAL).toEqual({ OPEN: 1, RESOLVED: 1 });
    expect(after.total).toBe(before.total);
  });

  it('zero-fills every seeded severity, so the mini-table never reflows', async () => {
    await create('MAJOR');

    const { data } = (await request(app).get('/api/inspections/summary')).body;

    expect(Object.keys(data.bySeverity).sort()).toEqual(['CRITICAL', 'MAJOR', 'MINOR']);
    expect(data.bySeverity.CRITICAL).toEqual({ OPEN: 0, RESOLVED: 0 });
  });

  it('returns an all-zero summary — not a 404 — when there is nothing logged', async () => {
    const response = await request(app).get('/api/inspections/summary');

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(0);
    expect(response.body.data.byStatus).toEqual({ OPEN: 0, RESOLVED: 0 });
    expect(response.body.data.bySeverity.CRITICAL).toEqual({ OPEN: 0, RESOLVED: 0 });
  });

  it('speaks in codes only — no ids and no labels', async () => {
    await create('MAJOR');

    const { data } = (await request(app).get('/api/inspections/summary')).body;

    // Labels come from the reference endpoints the client already loaded.
    expect(Object.keys(data.bySeverity.MAJOR).sort()).toEqual(['OPEN', 'RESOLVED']);
    expect(Object.keys(data).sort()).toEqual(['bySeverity', 'byStatus', 'total']);
  });
});
