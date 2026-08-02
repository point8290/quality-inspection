import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { backdate, closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

type Row = { machineId: string; severity: { code: string } };

async function create(overrides: Record<string, unknown>, createdAt?: Date) {
  const response = await request(app).post('/api/inspections').send(validCreateBody(overrides));
  const id = response.body.data.id as string;
  if (createdAt) {
    await backdate(id, createdAt);
  }
  return id;
}

async function rows(query: string) {
  const response = await request(app).get(`/api/inspections?${query}`);
  return response.body.data as Row[];
}

async function machineIds(query: string) {
  return (await rows(query)).map((row) => row.machineId);
}

/** Three rows whose inspectionDate, createdAt and severity all disagree on the order. */
async function seedSortable() {
  await create(
    { machineId: 'old-critical', inspectionDate: '2026-07-01', severityCode: 'CRITICAL' },
    new Date('2026-07-01T09:00:00.000Z'),
  );
  await create(
    { machineId: 'mid-minor', inspectionDate: '2026-07-10', severityCode: 'MINOR' },
    new Date('2026-07-02T09:00:00.000Z'),
  );
  await create(
    { machineId: 'new-major', inspectionDate: '2026-07-20', severityCode: 'MAJOR' },
    new Date('2026-07-03T09:00:00.000Z'),
  );
}

describe('GET /api/inspections — sorting', () => {
  it('defaults to newest created first', async () => {
    await seedSortable();

    expect(await machineIds('')).toEqual(['new-major', 'mid-minor', 'old-critical']);
  });

  it('sorts by inspection date in both directions', async () => {
    await seedSortable();

    const ascending = await machineIds('sortBy=inspectionDate&sortDir=asc');
    const descending = await machineIds('sortBy=inspectionDate&sortDir=desc');

    expect(ascending).toEqual(['old-critical', 'mid-minor', 'new-major']);
    expect(descending).toEqual([...ascending].reverse());
  });

  it('sorts by created date ascending', async () => {
    await seedSortable();

    expect(await machineIds('sortBy=createdAt&sortDir=asc')).toEqual([
      'old-critical',
      'mid-minor',
      'new-major',
    ]);
  });

  it('sorts by severity rank, not alphabetically', async () => {
    await seedSortable();

    // Alphabetically this would be CRITICAL, MAJOR, MINOR by accident — so the assertion
    // pins the intent: asc means rank 0, 1, 2, i.e. most severe first.
    const codes = (await rows('sortBy=severity&sortDir=asc')).map((row) => row.severity.code);

    expect(codes).toEqual(['CRITICAL', 'MAJOR', 'MINOR']);
  });

  it('reverses to least severe first', async () => {
    await seedSortable();

    const codes = (await rows('sortBy=severity&sortDir=desc')).map((row) => row.severity.code);

    expect(codes).toEqual(['MINOR', 'MAJOR', 'CRITICAL']);
  });

  it('breaks ties deterministically', async () => {
    // Same severity and same day: without a tiebreak the order would be whatever SQLite
    // felt like, which makes pagination unsafe.
    await create({ machineId: 'tie-1', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));
    await create({ machineId: 'tie-2', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));
    await create({ machineId: 'tie-3', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));

    const first = await machineIds('sortBy=severity&sortDir=asc');
    const second = await machineIds('sortBy=severity&sortDir=asc');

    expect(first).toEqual(second);
  });

  it('never drops or repeats a row across pages of a tied sort', async () => {
    await create({ machineId: 'tie-1', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));
    await create({ machineId: 'tie-2', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));
    await create({ machineId: 'tie-3', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));
    await create({ machineId: 'tie-4', inspectionDate: '2026-07-01', severityCode: 'MAJOR' },
      new Date('2026-07-01T09:00:00.000Z'));

    const page1 = await machineIds('sortBy=severity&sortDir=asc&pageSize=2&page=1');
    const page2 = await machineIds('sortBy=severity&sortDir=asc&pageSize=2&page=2');

    expect(new Set([...page1, ...page2]).size).toBe(4);
    expect(page1.filter((id) => page2.includes(id))).toEqual([]);
  });

  it('sorts within a filtered set', async () => {
    await seedSortable();

    const result = await machineIds('severityCode=MAJOR&sortBy=inspectionDate&sortDir=asc');

    expect(result).toEqual(['new-major']);
  });

  it('rejects an unknown sortBy', async () => {
    const response = await request(app).get('/api/inspections?sortBy=machineId');

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'sortBy' })]),
    );
  });

  it('rejects an unknown sortDir', async () => {
    const response = await request(app).get('/api/inspections?sortBy=createdAt&sortDir=sideways');

    expect(response.status).toBe(400);
  });
});
