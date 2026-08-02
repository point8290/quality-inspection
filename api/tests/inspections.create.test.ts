import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

describe('POST /api/inspections', () => {
  it('creates an inspection that starts OPEN and unresolved', async () => {
    const response = await request(app).post('/api/inspections').send(validCreateBody());

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('OPEN');
    expect(response.body.data.resolutionNote).toBeNull();
    expect(response.body.data.resolvedAt).toBeNull();
  });

  it('returns relations as code + label and never leaks the foreign keys', async () => {
    const response = await request(app).post('/api/inspections').send(validCreateBody());
    const { data } = response.body;

    expect(data.defectType).toEqual({ code: 'HOLE', label: expect.any(String) });
    expect(data.severity).toEqual({
      code: 'MAJOR',
      label: expect.any(String),
      rank: expect.any(Number),
    });
    expect(data).not.toHaveProperty('defectTypeId');
    expect(data).not.toHaveProperty('severityId');
  });

  it('round-trips inspectionDate as the exact calendar day, with no timezone shift', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ inspectionDate: '2026-01-01' }));

    // DATEONLY (DESIGN.md §2.3): the day the supervisor picked is the day we store and return,
    // whatever timezone the server or phone happens to be in.
    expect(response.body.data.inspectionDate).toBe('2026-01-01');

    const readBack = await request(app).get(`/api/inspections/${response.body.data.id}`);
    expect(readBack.body.data.inspectionDate).toBe('2026-01-01');
  });

  it('echoes the client-supplied id, so the offline outbox can key on it', async () => {
    const id = randomUUID();

    const response = await request(app).post('/api/inspections').send(validCreateBody({ id }));

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(id);
  });

  it('generates an id when the client does not supply one', async () => {
    const response = await request(app).post('/api/inspections').send(validCreateBody());

    expect(response.status).toBe(201);
    expect(response.body.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('accepts an inspection without remarks', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ remarks: undefined }));

    expect(response.status).toBe(201);
    expect(response.body.data.remarks).toBeNull();
  });

  it('ignores server-owned fields a client tries to set', async () => {
    const response = await request(app).post('/api/inspections').send(
      validCreateBody({
        status: 'RESOLVED',
        resolutionNote: 'sneaking this in',
        resolvedAt: '2020-01-01T00:00:00.000Z',
      }),
    );

    // Status, the note and resolvedAt are set by the resolve flow only (DESIGN.md §3.2).
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('OPEN');
    expect(response.body.data.resolutionNote).toBeNull();
    expect(response.body.data.resolvedAt).toBeNull();
  });

  it('wraps the created record in the success envelope', async () => {
    const response = await request(app).post('/api/inspections').send(validCreateBody());

    expect(Object.keys(response.body)).toEqual(['data']);
  });
});
