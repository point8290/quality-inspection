import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb } from './helpers/db';

// These assert against the seeded reference data — the seeders are the fixture (DESIGN.md §7.0).
afterAll(closeDb);

describe('GET /api/severities', () => {
  it('returns the seeded severities ordered by rank, most severe first', async () => {
    const response = await request(app).get('/api/severities');

    expect(response.status).toBe(200);
    expect(response.body.data.map((severity: { code: string }) => severity.code)).toEqual([
      'CRITICAL',
      'MAJOR',
      'MINOR',
    ]);
  });

  it('exposes code, label and rank — but never the database id', async () => {
    const response = await request(app).get('/api/severities');

    for (const severity of response.body.data) {
      expect(Object.keys(severity).sort()).toEqual(['code', 'label', 'rank']);
    }
  });
});

describe('GET /api/defect-types', () => {
  it('returns only active defect types, ordered by sortOrder', async () => {
    const response = await request(app).get('/api/defect-types');
    const codes = response.body.data.map((defectType: { code: string }) => defectType.code);

    expect(response.status).toBe(200);
    expect(codes).toContain('HOLE');
    expect(codes).toContain('OTHER');
    // MISPRINT is seeded with isActive = false, so it must not reach a dropdown.
    expect(codes).not.toContain('MISPRINT');
    expect(codes[0]).toBe('HOLE');
  });

  it('exposes code and label — but never the database id', async () => {
    const response = await request(app).get('/api/defect-types');

    for (const defectType of response.body.data) {
      expect(Object.keys(defectType).sort()).toEqual(['code', 'label']);
    }
  });
});
