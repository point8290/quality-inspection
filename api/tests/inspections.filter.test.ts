import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

type Row = { machineId: string };

async function create(overrides: Record<string, unknown>) {
  const response = await request(app).post('/api/inspections').send(validCreateBody(overrides));
  return response.body.data.id as string;
}

async function resolve(id: string) {
  await request(app).patch(`/api/inspections/${id}/resolve`).send({ resolutionNote: 'Fixed' });
}

async function machineIds(query: string) {
  const response = await request(app).get(`/api/inspections?${query}`);
  return (response.body.data as Row[]).map((row) => row.machineId);
}

/**
 * A small fixed set covering every filterable dimension:
 *   A  2026-07-01  CRITICAL  HOLE   (resolved)
 *   B  2026-07-10  MAJOR     STAIN
 *   C  2026-07-20  MINOR     HOLE
 */
async function seedMix() {
  const a = await create({
    machineId: 'A',
    inspectionDate: '2026-07-01',
    severityCode: 'CRITICAL',
    defectTypeCode: 'HOLE',
  });
  await create({
    machineId: 'B',
    inspectionDate: '2026-07-10',
    severityCode: 'MAJOR',
    defectTypeCode: 'STAIN',
  });
  await create({
    machineId: 'C',
    inspectionDate: '2026-07-20',
    severityCode: 'MINOR',
    defectTypeCode: 'HOLE',
  });
  await resolve(a);
}

describe('GET /api/inspections — filtering', () => {
  it('filters by status', async () => {
    await seedMix();

    expect((await machineIds('status=RESOLVED')).sort()).toEqual(['A']);
    expect((await machineIds('status=OPEN')).sort()).toEqual(['B', 'C']);
  });

  it('filters by severity code', async () => {
    await seedMix();

    expect(await machineIds('severityCode=MAJOR')).toEqual(['B']);
  });

  it('filters by defect type code', async () => {
    await seedMix();

    expect((await machineIds('defectTypeCode=HOLE')).sort()).toEqual(['A', 'C']);
  });

  it('treats the date range as inclusive at both ends', async () => {
    await seedMix();

    // The boundary days themselves must be in the result, not just the days between.
    expect((await machineIds('dateFrom=2026-07-01&dateTo=2026-07-20')).sort()).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect((await machineIds('dateFrom=2026-07-10&dateTo=2026-07-10')).sort()).toEqual(['B']);
  });

  it('supports open-ended ranges', async () => {
    await seedMix();

    expect((await machineIds('dateFrom=2026-07-10')).sort()).toEqual(['B', 'C']);
    expect((await machineIds('dateTo=2026-07-10')).sort()).toEqual(['A', 'B']);
  });

  it('combines filters with AND', async () => {
    await seedMix();

    expect(await machineIds('status=OPEN&defectTypeCode=HOLE')).toEqual(['C']);
    expect(await machineIds('status=OPEN&defectTypeCode=HOLE&severityCode=CRITICAL')).toEqual([]);
  });

  it('applies filters to meta.total, not just to the page', async () => {
    await seedMix();

    const response = await request(app).get('/api/inspections?defectTypeCode=HOLE');

    expect(response.body.meta.total).toBe(2);
    expect(response.body.meta.totalPages).toBe(1);
  });

  it('keeps the filter applied on later pages', async () => {
    await seedMix();

    const response = await request(app).get('/api/inspections?defectTypeCode=HOLE&pageSize=1&page=2');

    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.total).toBe(2);
    expect(['A', 'C']).toContain(response.body.data[0].machineId);
  });

  it('returns an empty list when nothing matches', async () => {
    await seedMix();

    const response = await request(app).get('/api/inspections?severityCode=CRITICAL&status=OPEN');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });
});

describe('GET /api/inspections — filter validation', () => {
  it('rejects an unknown status', async () => {
    const response = await request(app).get('/api/inspections?status=PENDING');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'status' })]),
    );
  });

  it('rejects an unknown severity code', async () => {
    // One rule for codes across create and filter: a code we don't know is a 400, even
    // though a filter conceptually narrows rather than validates.
    const response = await request(app).get('/api/inspections?severityCode=BANANA');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'severityCode' })]),
    );
  });

  it('rejects an unknown defect type code', async () => {
    const response = await request(app).get('/api/inspections?defectTypeCode=BANANA');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'defectTypeCode' })]),
    );
  });

  it('rejects a malformed date', async () => {
    const response = await request(app).get('/api/inspections?dateFrom=01-07-2026');

    expect(response.status).toBe(400);
  });

  it('rejects an impossible date', async () => {
    const response = await request(app).get('/api/inspections?dateTo=2026-02-31');

    expect(response.status).toBe(400);
  });

  it('rejects a range where dateFrom is after dateTo', async () => {
    // Better a clear 400 than a silently empty list the user can't explain.
    const response = await request(app).get('/api/inspections?dateFrom=2026-07-20&dateTo=2026-07-01');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'dateTo' })]),
    );
  });
});
