import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { backdate, closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

/**
 * Creates rows with controlled createdAt values so ordering assertions can't be decided by
 * a clock tie — three HTTP round-trips can land in the same millisecond.
 */
async function seedInspections(machineIds: string[]) {
  for (const [index, machineId] of machineIds.entries()) {
    const created = await request(app).post('/api/inspections').send(validCreateBody({ machineId }));
    await backdate(created.body.data.id, new Date(`2026-07-0${index + 1}T09:00:00.000Z`));
  }
}

describe('GET /api/inspections', () => {
  it('returns an empty list — not a 404 — when there is nothing to show', async () => {
    const response = await request(app).get('/api/inspections');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('returns pagination meta alongside the rows', async () => {
    await seedInspections(['LOOM-01', 'LOOM-02']);

    const response = await request(app).get('/api/inspections');

    expect(response.body.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('defaults to newest first', async () => {
    await seedInspections(['oldest', 'middle', 'newest']);

    const response = await request(app).get('/api/inspections');

    expect(response.body.data.map((row: { machineId: string }) => row.machineId)).toEqual([
      'newest',
      'middle',
      'oldest',
    ]);
  });

  it('paginates, and reports the total across all pages rather than the page size', async () => {
    await seedInspections(['a', 'b', 'c', 'd', 'e']);

    const response = await request(app).get('/api/inspections?page=2&pageSize=2');

    expect(response.body.data.map((row: { machineId: string }) => row.machineId)).toEqual(['c', 'b']);
    expect(response.body.meta).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
  });

  it('returns an empty page past the end without erroring', async () => {
    await seedInspections(['a', 'b']);

    const response = await request(app).get('/api/inspections?page=9&pageSize=2');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(2);
  });

  it('expands relations to codes on every row', async () => {
    await seedInspections(['LOOM-01']);

    const response = await request(app).get('/api/inspections');

    expect(response.body.data[0].defectType).toEqual({ code: 'HOLE', label: expect.any(String) });
    expect(response.body.data[0]).not.toHaveProperty('defectTypeId');
  });

  it('rejects a pageSize above the cap', async () => {
    const response = await request(app).get('/api/inspections?pageSize=500');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects non-numeric paging params', async () => {
    const response = await request(app).get('/api/inspections?page=abc');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
