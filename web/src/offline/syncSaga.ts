import { call, delay, put, takeLeading } from 'redux-saga/effects';
import { ApiRequestError } from '../api/client';
import { createInspection, pullInspectionsSince, resolveInspection } from '../api/inspections';
import type { ApiSuccess, Inspection, PageMeta } from '../api/types';
import { listRequested } from '../features/inspections/slice';
import { summaryRequested } from '../features/summary/slice';
import type { OutboxOp } from './db';
import { putInspections, readCursor, writeCursor } from './mirror';
import { dequeue, listDeadLetter, listPending, moveToDeadLetter } from './outbox';
import {
  deadLetterLoaded,
  outboxLoaded,
  syncFailed,
  syncRequested,
  syncStarted,
  syncSucceeded,
} from './slice';

const MAX_DRAIN_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;
/** No cursor yet means "everything has changed since the beginning of time". */
const EPOCH = '1970-01-01T00:00:00.000Z';

/** Exponential, capped — so a long outage doesn't schedule a retry hours away. */
export function backoffFor(attempt: number) {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
}

function statusOf(error: unknown) {
  return error instanceof ApiRequestError ? error.status : 0;
}

/**
 * Replays queued mutations against the server, in the order they were made.
 *
 * Returns true if the queue emptied, false if it stopped early — the caller uses that to
 * decide whether to back off and retry.
 */
export function* drainOutbox(): Generator<unknown, boolean, any> {
  const ops: OutboxOp[] = yield call(listPending);

  for (const op of ops) {
    try {
      if (op.type === 'CREATE') {
        // 201 (new) and 200 (already exists) are both success, and the client doesn't need
        // to tell them apart — which is exactly why the server answers 200 rather than a
        // conflict when a replayed create carries an id it already has.
        yield call(createInspection, op.payload);
      } else {
        yield call(resolveInspection, op.inspectionId, op.payload.resolutionNote);
      }

      yield call(dequeue, op.seq as number);
    } catch (error) {
      const status = statusOf(error);

      // Offline, a 409 means "my own queued op already landed" — a reconciliation, not a
      // conflict. Online the same status is shown to the user, because there someone else
      // resolved it (DESIGN.md §5.2).
      if (op.type === 'RESOLVE' && status === 409) {
        yield call(dequeue, op.seq as number);
        continue;
      }

      // A rejected payload can't be fixed by retrying, so it must not sit in the queue
      // forever pretending it will succeed. It becomes visible instead.
      if (status === 400) {
        yield call(moveToDeadLetter, op, {
          opId: op.opId,
          type: op.type,
          inspectionId: op.inspectionId,
          reason: error instanceof Error ? error.message : 'Rejected by the server',
          failedAt: new Date().toISOString(),
        });
        continue;
      }

      // Network error or 5xx: keep it queued and stop. Continuing would burn the whole
      // queue against a dead network and inflate every op's attempt count.
      return false;
    }
  }

  return true;
}

/**
 * Refreshes the mirror with everything that changed on the server since our cursor, paging
 * until the last page. Truncating at one page would leave a silent hole in the mirror after
 * a long offline stretch.
 */
export function* pullDelta(): Generator<unknown, void, any> {
  const stored: { value: string } | undefined = yield call(readCursor);
  const cursor = stored?.value ?? EPOCH;

  let page = 1;
  let latest = cursor;

  for (;;) {
    const response: ApiSuccess<Inspection[], PageMeta> = yield call(
      pullInspectionsSince,
      cursor,
      page,
    );

    if (response.data.length === 0) {
      break;
    }

    yield call(putInspections, response.data);
    // Sync mode orders by updatedAt ascending, so the last row of the last page is the
    // newest thing we've seen.
    latest = response.data[response.data.length - 1].updatedAt;

    if (page >= (response.meta?.totalPages ?? 1)) {
      break;
    }

    page += 1;
  }

  // Only reached if every page stored cleanly: a throw above leaves the cursor where it
  // was, so the next sync re-pulls rather than skipping rows we never wrote.
  yield call(writeCursor, latest);
}

/** Mirrors the Dexie queues back into Redux so the UI reflects them. */
function* refreshQueues(): Generator<unknown, void, any> {
  const pending: OutboxOp[] = yield call(listPending);
  yield put(outboxLoaded(pending));

  const dead = yield call(listDeadLetter);
  yield put(deadLetterLoaded(dead));
}

export function* runSync(): Generator<unknown, void, any> {
  yield put(syncStarted());

  try {
    for (let attempt = 0; attempt < MAX_DRAIN_ATTEMPTS; attempt += 1) {
      const drained: boolean = yield call(drainOutbox);
      yield call(refreshQueues);

      if (drained) {
        yield call(pullDelta);
        yield put(syncSucceeded());
        // Re-render from the freshly reconciled server state.
        yield put(listRequested());
        yield put(summaryRequested());
        return;
      }

      yield delay(backoffFor(attempt));
    }

    yield put(syncFailed('Could not reach the server — your changes are still queued'));
  } catch (error) {
    yield put(syncFailed(error instanceof Error ? error.message : 'Sync failed'));
    yield call(refreshQueues);
  }
}

/**
 * takeLeading is the single-flight guarantee: `online` can fire more than once, and the app
 * also asks for a sync on every write, so without it two drains could replay the same op
 * concurrently.
 */
export function* syncSaga() {
  yield takeLeading(syncRequested.type, runSync);
}
