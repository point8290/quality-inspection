import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

async function createInspection() {
  const response = await request(app).post('/api/inspections').send(validCreateBody());
  return response.body.data.id as string;
}

function resolve(id: string, body: Record<string, unknown>) {
  return request(app).patch(`/api/inspections/${id}/resolve`).send(body);
}

describe('PATCH /api/inspections/:id/resolve', () => {
  it('resolves an open inspection and records the note', async () => {
    const id = await createInspection();

    const response = await resolve(id, { resolutionNote: 'Re-wove the section and re-inspected' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('RESOLVED');
    expect(response.body.data.resolutionNote).toBe('Re-wove the section and re-inspected');
    expect(response.body.data.resolvedAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(response.body.data.resolvedAt))).toBe(false);
  });

  it('sets resolvedAt itself and ignores one supplied by the client', async () => {
    const id = await createInspection();

    const response = await resolve(id, {
      resolutionNote: 'Fixed',
      resolvedAt: '2001-01-01T00:00:00.000Z',
    });

    expect(response.body.data.resolvedAt).not.toContain('2001');
  });

  it('shows the resolution on re-read, in both the detail and the list', async () => {
    const id = await createInspection();
    await resolve(id, { resolutionNote: 'Cleared by the shift supervisor' });

    const detail = await request(app).get(`/api/inspections/${id}`);
    const list = await request(app).get('/api/inspections');

    expect(detail.body.data.status).toBe('RESOLVED');
    expect(detail.body.data.resolutionNote).toBe('Cleared by the shift supervisor');
    expect(list.body.data[0].status).toBe('RESOLVED');
  });

  it('bumps updatedAt, so the offline delta pull will see the change', async () => {
    const id = await createInspection();
    const before = await request(app).get(`/api/inspections/${id}`);

    await resolve(id, { resolutionNote: 'Fixed' });
    const after = await request(app).get(`/api/inspections/${id}`);

    expect(Date.parse(after.body.data.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(before.body.data.updatedAt),
    );
    expect(after.body.data.createdAt).toBe(before.body.data.createdAt);
  });
});

describe('PATCH /api/inspections/:id/resolve — the note is mandatory', () => {
  it('rejects a missing note', async () => {
    const id = await createInspection();

    const response = await resolve(id, {});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'resolutionNote' })]),
    );
  });

  it('rejects an empty note', async () => {
    const id = await createInspection();

    const response = await resolve(id, { resolutionNote: '' });

    expect(response.status).toBe(400);
  });

  it('rejects a whitespace-only note', async () => {
    const id = await createInspection();

    // "Mandatory" has to mean something a human actually wrote, so it is trimmed first.
    const response = await resolve(id, { resolutionNote: '   \n  ' });

    expect(response.status).toBe(400);
  });

  it('rejects a note longer than the column allows', async () => {
    const id = await createInspection();

    const response = await resolve(id, { resolutionNote: 'x'.repeat(1001) });

    expect(response.status).toBe(400);
  });

  it('leaves the inspection open when the note is rejected', async () => {
    const id = await createInspection();

    await resolve(id, { resolutionNote: '  ' });

    const detail = await request(app).get(`/api/inspections/${id}`);
    expect(detail.body.data.status).toBe('OPEN');
    expect(detail.body.data.resolutionNote).toBeNull();
    expect(detail.body.data.resolvedAt).toBeNull();
  });
});

describe('PATCH /api/inspections/:id/resolve — resolve once', () => {
  it('cannot resolve the same inspection twice', async () => {
    const id = await createInspection();
    await resolve(id, { resolutionNote: 'First resolution' });

    const second = await resolve(id, { resolutionNote: 'Second resolution' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_RESOLVED');
  });

  it('does not let the second attempt overwrite the first resolution', async () => {
    const id = await createInspection();
    const first = await resolve(id, { resolutionNote: 'First resolution' });

    await resolve(id, { resolutionNote: 'Second resolution' });

    const detail = await request(app).get(`/api/inspections/${id}`);
    expect(detail.body.data.resolutionNote).toBe('First resolution');
    expect(detail.body.data.resolvedAt).toBe(first.body.data.resolvedAt);
  });
});

describe('PATCH /api/inspections/:id/resolve — addressing', () => {
  it('answers 404 for an id that does not exist', async () => {
    const response = await resolve(randomUUID(), { resolutionNote: 'Fixed' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 — not 500 — for a malformed id', async () => {
    const response = await resolve('not-a-uuid', { resolutionNote: 'Fixed' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
