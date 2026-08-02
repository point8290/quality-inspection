import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closeDb, resetMutableTables } from './helpers/db';
import { validCreateBody } from './helpers/factories';

beforeEach(resetMutableTables);
afterAll(closeDb);

/** Every rejection uses the same error envelope, so the client branches on one shape. */
function expectValidationError(response: request.Response, field: string) {
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(response.body.error.details).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: field })]),
  );
}

async function countInspections() {
  const response = await request(app).get('/api/inspections');
  return response.body.meta.total;
}

describe('POST /api/inspections — validation', () => {
  it('rejects an unknown defect type code and writes nothing', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ defectTypeCode: 'NOT_A_DEFECT' }));

    expectValidationError(response, 'defectTypeCode');
    expect(await countInspections()).toBe(0);
  });

  it('rejects an unknown severity code and writes nothing', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ severityCode: 'CATASTROPHIC' }));

    expectValidationError(response, 'severityCode');
    expect(await countInspections()).toBe(0);
  });

  it('rejects a missing machineId', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ machineId: undefined }));

    expectValidationError(response, 'machineId');
  });

  it('rejects a missing defectTypeCode', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ defectTypeCode: undefined }));

    expectValidationError(response, 'defectTypeCode');
  });

  it('rejects a missing severityCode', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ severityCode: undefined }));

    expectValidationError(response, 'severityCode');
  });

  it('rejects a missing inspectionDate', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ inspectionDate: undefined }));

    expectValidationError(response, 'inspectionDate');
  });

  it('rejects a whitespace-only machineId', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ machineId: '   ' }));

    expectValidationError(response, 'machineId');
  });

  it('rejects a wrongly formatted inspectionDate', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ inspectionDate: '15-07-2026' }));

    expectValidationError(response, 'inspectionDate');
  });

  it('rejects a well-formed but impossible calendar date', async () => {
    // Passes the YYYY-MM-DD regex; only the real-date refine catches it (DESIGN.md §3).
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ inspectionDate: '2026-02-31' }));

    expectValidationError(response, 'inspectionDate');
  });

  it('rejects a client id that is not a UUID', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ id: 'not-a-uuid' }));

    expectValidationError(response, 'id');
  });

  it('rejects remarks longer than the column allows', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ remarks: 'x'.repeat(1001) }));

    expectValidationError(response, 'remarks');
  });

  it('never returns a stack trace or SQL in the error body', async () => {
    const response = await request(app)
      .post('/api/inspections')
      .send(validCreateBody({ severityCode: 'CATASTROPHIC' }));

    expect(Object.keys(response.body)).toEqual(['error']);
    expect(Object.keys(response.body.error).sort()).toEqual(['code', 'details', 'message']);
  });
});
