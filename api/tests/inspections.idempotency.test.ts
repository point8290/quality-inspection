import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

async function countInspections() {
  const response = await request(app).get('/api/inspections');
  return response.body.meta.total;
}

/**
 * The offline outbox replays queued creates at-least-once (DESIGN.md §5.2), so the same
 * client id can legitimately arrive twice. It must never produce two rows.
 */
describe('POST /api/inspections — idempotency on the client id', () => {
  it('creates one row and answers 200 the second time the same id is posted', async () => {
    const id = randomUUID();
    const body = validCreateBody({ id });

    const first = await request(app).post('/api/inspections').send(body);
    const second = await request(app).post('/api/inspections').send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(id);
    expect(await countInspections()).toBe(1);
  });

  it('returns the stored record unchanged when a replay carries a divergent body', async () => {
    const id = randomUUID();

    await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ id, machineId: 'LOOM-04' }));

    const replay = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ id, machineId: 'LOOM-99', severityCode: 'CRITICAL' }));

    // Treated as a no-op rather than 409, to keep offline replay bulletproof (DESIGN.md §4).
    expect(replay.status).toBe(200);
    expect(replay.body.data.machineId).toBe('LOOM-04');
    expect(replay.body.data.severity.code).toBe('MAJOR');
    expect(await countInspections()).toBe(1);
  });

  it('still creates separate rows for separate ids', async () => {
    await request(app).post('/api/inspections').send(validCreateBody({ id: randomUUID() }));
    await request(app).post('/api/inspections').send(validCreateBody({ id: randomUUID() }));

    expect(await countInspections()).toBe(2);
  });
});
