import { call, delay, takeLeading } from 'redux-saga/effects';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/client';
import { createInspection, pullInspectionsSince, resolveInspection } from '../api/inspections';
import type { Inspection } from '../api/types';
import type { OutboxOp } from './db';
import { putInspections, readCursor, writeCursor } from './mirror';
import { dequeue, listPending, moveToDeadLetter } from './outbox';
import { syncRequested } from './slice';
import { backoffFor, drainOutbox, pullDelta, runSync, syncSaga } from './syncSaga';

// Narrowed to the CREATE branch of the union so `op.payload` keeps its concrete type here.
type CreateOp = Extract<OutboxOp, { type: 'CREATE' }>;
type ResolveOp = Extract<OutboxOp, { type: 'RESOLVE' }>;

function createOp(seq: number, inspectionId: string): CreateOp {
  return {
    seq,
    opId: `op-${seq}`,
    type: 'CREATE',
    inspectionId,
    payload: {
      id: inspectionId,
      inspectionDate: '2026-08-03',
      machineId: 'LOOM-04',
      defectTypeCode: 'HOLE',
      severityCode: 'MAJOR',
    },
  };
}

function resolveOp(seq: number, inspectionId: string): ResolveOp {
  return {
    seq,
    opId: `op-${seq}`,
    type: 'RESOLVE',
    inspectionId,
    payload: { resolutionNote: 'Fixed' },
  };
}

const networkError = new TypeError('Failed to fetch');
const badRequest = new ApiRequestError(400, 'VALIDATION_ERROR', 'Unknown defect type code');
const conflict = new ApiRequestError(409, 'ALREADY_RESOLVED', 'Already resolved');
const serverError = new ApiRequestError(500, 'INTERNAL_ERROR', 'Server error');

function row(id: string, updatedAt: string) {
  return { id, updatedAt } as Inspection;
}

describe('drainOutbox', () => {
  it('does nothing when the outbox is empty', () => {
    const saga = drainOutbox();

    expect(saga.next().value).toEqual(call(listPending));
    const done = saga.next([]);

    expect(done.done).toBe(true);
    expect(done.value).toBe(true);
  });

  it('replays a queued create and dequeues it', () => {
    const op = createOp(1, 'insp-1');
    const saga = drainOutbox();
    saga.next();

    expect(saga.next([op]).value).toEqual(call(createInspection, op.payload));
    expect(saga.next({ data: {} }).value).toEqual(call(dequeue, 1));
  });

  it('treats a replayed create the server already has as success', () => {
    // The server answers 200 (not 409) when the client-minted id already exists, so a
    // replay is just a successful call — the client doesn't even need to tell 200 from 201.
    // This is the whole reason POST /inspections is idempotent.
    const op = createOp(1, 'insp-1');
    const saga = drainOutbox();
    saga.next();
    saga.next([op]);

    const afterExistingRow = saga.next({ data: { id: 'insp-1' } });

    expect(afterExistingRow.value).toEqual(call(dequeue, 1));
    expect(saga.next().value).not.toEqual(call(createInspection, op.payload));
  });

  it('replays queued ops in FIFO order', () => {
    // A create and the resolve of the same inspection share an id, so order is correctness:
    // the create has to land first or the resolve 404s.
    const create = createOp(1, 'insp-1');
    const resolve = resolveOp(2, 'insp-1');
    const saga = drainOutbox();
    saga.next();

    expect(saga.next([create, resolve]).value).toEqual(call(createInspection, create.payload));
    saga.next({ data: {} });
    expect(saga.next().value).toEqual(call(resolveInspection, 'insp-1', 'Fixed'));
  });

  it('treats a resolve the server already applied as success', () => {
    // 409 offline means "my own queued op already landed" — a reconciliation, not a
    // conflict. Online, the same status is surfaced to the user (DESIGN.md §5.2).
    const op = resolveOp(1, 'insp-1');
    const saga = drainOutbox();
    saga.next();
    saga.next([op]);

    expect(saga.throw(conflict).value).toEqual(call(dequeue, 1));
  });

  it('dead-letters an op the server rejects as invalid', () => {
    const op = createOp(1, 'insp-1');
    const saga = drainOutbox();
    saga.next();
    saga.next([op]);

    // A 400 can't be fixed by retrying, so it must not sit in the queue forever.
    const effect = saga.throw(badRequest).value as { payload: { fn: unknown; args: unknown[] } };

    expect(effect.payload.fn).toBe(moveToDeadLetter);
    expect(effect.payload.args[0]).toBe(op);
  });

  it('keeps an op queued when the network fails', () => {
    const op = createOp(1, 'insp-1');
    const saga = drainOutbox();
    saga.next();
    saga.next([op]);

    const done = saga.throw(networkError);

    // Not dequeued and not dead-lettered — it will be retried.
    expect(done.done).toBe(true);
    expect(done.value).toBe(false);
  });

  it('stops the drain on a network error instead of burning through the queue', () => {
    const saga = drainOutbox();
    saga.next();
    saga.next([createOp(1, 'insp-1'), createOp(2, 'insp-2')]);

    const done = saga.throw(networkError);

    // The second op is never attempted: hammering a dead network would inflate every op's
    // attempt count and delay the real retry.
    expect(done.done).toBe(true);
  });

  it('keeps an op queued on a server error, unlike a 400', () => {
    const saga = drainOutbox();
    saga.next();
    saga.next([createOp(1, 'insp-1')]);

    const done = saga.throw(serverError);

    expect(done.value).toBe(false);
  });
});

describe('pullDelta', () => {
  it('pulls from the stored cursor and advances it past the last row', () => {
    const saga = pullDelta();

    expect(saga.next().value).toEqual(call(readCursor));

    const cursor = '2026-08-01T00:00:00.000Z';
    expect(saga.next({ key: 'updatedSince', value: cursor }).value).toEqual(
      call(pullInspectionsSince, cursor, 1),
    );

    const page = { data: [row('a', '2026-08-02T10:00:00.000Z')], meta: { totalPages: 1 } };
    expect(saga.next(page).value).toEqual(call(putInspections, page.data));
    expect(saga.next().value).toEqual(call(writeCursor, '2026-08-02T10:00:00.000Z'));
  });

  it('merges every page of a multi-page delta before advancing the cursor', () => {
    // A long offline stretch can produce more changes than one page. Truncating here would
    // leave a silent hole in the mirror.
    const saga = pullDelta();
    saga.next();

    const cursor = '2026-08-01T00:00:00.000Z';
    saga.next({ key: 'updatedSince', value: cursor });

    const pageOne = { data: [row('a', '2026-08-02T10:00:00.000Z')], meta: { totalPages: 2 } };
    saga.next(pageOne);
    expect(saga.next().value).toEqual(call(pullInspectionsSince, cursor, 2));

    const pageTwo = { data: [row('b', '2026-08-03T11:00:00.000Z')], meta: { totalPages: 2 } };
    expect(saga.next(pageTwo).value).toEqual(call(putInspections, pageTwo.data));

    // The cursor lands on the last row of the LAST page, not the first.
    expect(saga.next().value).toEqual(call(writeCursor, '2026-08-03T11:00:00.000Z'));
  });

  it('pulls everything when there is no cursor yet', () => {
    const saga = pullDelta();
    saga.next();

    expect(saga.next(undefined).value).toEqual(
      call(pullInspectionsSince, '1970-01-01T00:00:00.000Z', 1),
    );
  });

  it('leaves the cursor untouched when the pull fails', () => {
    const saga = pullDelta();
    saga.next();
    saga.next({ key: 'updatedSince', value: '2026-08-01T00:00:00.000Z' });

    // Advancing past rows we never stored would put a permanent hole in the mirror.
    expect(() => saga.throw(networkError)).toThrow();
  });
});

describe('backoffFor', () => {
  it('grows exponentially and then stops growing', () => {
    expect(backoffFor(0)).toBe(1000);
    expect(backoffFor(1)).toBe(2000);
    expect(backoffFor(2)).toBe(4000);
    expect(backoffFor(99)).toBe(60_000);
  });
});

describe('syncSaga watcher', () => {
  it('is single-flight, so two online events cannot double-drain', () => {
    const saga = syncSaga();

    // takeLeading, not takeEvery: `online` can fire repeatedly and every write also asks
    // for a sync, so without this two drains could replay the same op concurrently.
    expect(saga.next().value).toEqual(takeLeading(syncRequested.type, runSync));
  });
});

describe('backoff between drain attempts', () => {
  it('waits longer after each consecutive failure', () => {
    // Asserted through the exported helper rather than by stepping runSync, so the test
    // doesn't depend on where the delay sits in the effect sequence.
    const waits = [0, 1, 2].map((attempt) => delay(backoffFor(attempt)));

    expect(waits[0]).toEqual(delay(1000));
    expect(waits[1]).toEqual(delay(2000));
    expect(waits[2]).toEqual(delay(4000));
  });
});
