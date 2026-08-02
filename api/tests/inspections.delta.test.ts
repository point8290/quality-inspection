import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables, setUpdatedAt } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

type Row = { machineId: string; updatedAt: string };

const CURSOR = '2026-07-10T12:00:00.000Z';

async function createAt(machineId: string, updatedAt: string) {
  const response = await request(app).post('/api/inspections').send(validCreateBody({ machineId }));
  await setUpdatedAt(response.body.data.id, new Date(updatedAt));
  return response.body.data.id as string;
}

async function machineIds(query: string) {
  const response = await request(app).get(`/api/inspections?${query}`);
  return (response.body.data as Row[]).map((row) => row.machineId);
}

/**
 * The delta pull is a distinct sync mode, not another filter: it exists so a reconnecting
 * client refreshes its mirror without a full refetch (DESIGN.md §4).
 */
describe('GET /api/inspections?updatedSince', () => {
  it('returns only rows changed after the cursor', async () => {
    await createAt('before', '2026-07-10T11:59:59.000Z');
    await createAt('after', '2026-07-10T12:00:01.000Z');

    expect(await machineIds(`updatedSince=${CURSOR}`)).toEqual(['after']);
  });

  it('excludes a row sitting exactly on the cursor', async () => {
    await createAt('exactly-on-cursor', CURSOR);
    await createAt('after', '2026-07-10T12:00:01.000Z');

    // Exclusive (updatedAt > cursor): a client re-syncing with its last-seen timestamp
    // must not re-pull the row that produced that timestamp.
    expect(await machineIds(`updatedSince=${CURSOR}`)).toEqual(['after']);
  });

  it('orders by updatedAt ascending, for stable forward paging', async () => {
    await createAt('third', '2026-07-10T15:00:00.000Z');
    await createAt('first', '2026-07-10T13:00:00.000Z');
    await createAt('second', '2026-07-10T14:00:00.000Z');

    expect(await machineIds(`updatedSince=${CURSOR}`)).toEqual(['first', 'second', 'third']);
  });

  it('picks up a resolve, because resolving bumps updatedAt', async () => {
    const id = await createAt('resolved-later', '2026-07-10T11:00:00.000Z');

    expect(await machineIds(`updatedSince=${CURSOR}`)).toEqual([]);

    await request(app).patch(`/api/inspections/${id}/resolve`).send({ resolutionNote: 'Fixed' });

    expect(await machineIds(`updatedSince=${CURSOR}`)).toEqual(['resolved-later']);
  });

  it('rejects a malformed cursor', async () => {
    const response = await request(app).get('/api/inspections?updatedSince=yesterday');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'updatedSince' })]),
    );
  });

  it('refuses to combine sync mode with an explicit sort', async () => {
    // Sync mode owns the ordering (updatedAt ASC). Silently ignoring sortBy would be a
    // surprise; saying so is clearer.
    const response = await request(app).get(
      `/api/inspections?updatedSince=${CURSOR}&sortBy=severity`,
    );

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'sortBy' })]),
    );
  });
});
