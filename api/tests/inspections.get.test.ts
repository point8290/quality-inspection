import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

describe('GET /api/inspections/:id', () => {
  it('returns one inspection with its relations expanded to codes', async () => {
    const created = await request(app).post('/api/inspections').send(validCreateBody());

    const response = await request(app).get(`/api/inspections/${created.body.data.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(created.body.data.id);
    expect(response.body.data.defectType.code).toBe('HOLE');
    expect(response.body.data.severity.code).toBe('MAJOR');
  });

  it('answers 404 for an id that does not exist', async () => {
    const response = await request(app).get(`/api/inspections/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 — not 500 — for a malformed id', async () => {
    const response = await request(app).get('/api/inspections/not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
