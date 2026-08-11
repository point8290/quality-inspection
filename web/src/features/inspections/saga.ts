import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { listInspections } from '../../api/inspections';
import type {
  ApiSuccess,
  CreateInspectionPayload,
  DefectType,
  Inspection,
  ListQuery,
  PageMeta,
  Severity,
} from '../../api/types';
import { putInspection, putInspections, readInspections } from '../../offline/mirror';
import { enqueue, listPending } from '../../offline/outbox';
import { outboxLoaded, syncRequested } from '../../offline/slice';
import { summaryRequested } from '../summary/slice';
import { selectInspectionById, selectListQuery } from './selectors';
import {
  createFailed,
  createRequested,
  createSucceeded,
  filtersChanged,
  filtersCleared,
  listFailed,
  listRequested,
  listSucceeded,
  pageChanged,
  resolveRequested,
  resolveSucceeded,
  sortChanged,
} from './slice';

/**
 * Exported so tests can step the generator and assert the effects it yields.
 *
 * The `any` is the standard redux-saga annotation: each `yield` resolves to a different
 * type (a query, then a response) and TypeScript can't track that per-yield, so the value
 * is typed at each assignment instead.
 */
export function* fetchList(): Generator<unknown, void, any> {
  try {
    // The reducers have already applied the filter/sort/page change, so the saga reads the
    // finished query out of state rather than reassembling it from an action payload.
    const query: ListQuery = yield select(selectListQuery);
    const response: ApiSuccess<Inspection[], PageMeta> = yield call(listInspections, query);

    yield put(
      listSucceeded({
        items: response.data,
        // The API always sends meta on the list; this keeps the reducer's type honest.
        meta: response.meta ?? {
          page: query.page,
          pageSize: response.data.length,
          total: response.data.length,
          totalPages: 1,
        },
      }),
    );

    // Write through to the mirror so the same rows render on a cold, offline start.
    yield call(putInspections, response.data);
  } catch (error) {
    // Offline, the mirror is the read path: showing the last known list beats showing an
    // error for data we already have on the device (DESIGN.md §5.2).
    const mirrored: Inspection[] = yield call(readInspections);

    if (mirrored.length > 0) {
      yield put(
        listSucceeded({
          items: mirrored,
          meta: {
            page: 1,
            pageSize: mirrored.length,
            total: mirrored.length,
            totalPages: 1,
          },
        }),
      );
      return;
    }

    yield put(listFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Builds the row the UI shows before the server has seen it. Everything here is already
 * known on the device: the id is client-minted, and the labels come from reference data.
 */
function buildOptimisticInspection(
  payload: CreateInspectionPayload,
  defectTypes: DefectType[],
  severities: Severity[],
): Inspection {
  const now = new Date().toISOString();
  const defectType = defectTypes.find((type) => type.code === payload.defectTypeCode);
  const severity = severities.find((option) => option.code === payload.severityCode);

  return {
    id: payload.id,
    inspectionDate: payload.inspectionDate,
    machineId: payload.machineId,
    defectType: defectType ?? { code: payload.defectTypeCode, label: payload.defectTypeCode },
    severity: severity ?? { code: payload.severityCode, label: payload.severityCode, rank: 99 },
    remarks: payload.remarks ?? null,
    status: 'OPEN',
    source: 'MANUAL',
    resolutionNote: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Mirrors the Dexie outbox into Redux, so `selectIsPending` is accurate the moment a write lands. */
export function* publishOutbox(): Generator<unknown, void, any> {
  const pending = yield call(listPending);
  yield put(outboxLoaded(pending));
}

/**
 * Every write goes through the outbox — there is no online/offline branch. Online is simply
 * the case where the drain happens immediately (DESIGN.md §5.2).
 *
 * Two code paths would mean a connection dropping between the `navigator.onLine` check and
 * the request produces a silently lost write. One path can't have that bug.
 */
export function* submitCreate(
  action: PayloadAction<CreateInspectionPayload>,
): Generator<unknown, void, any> {
  try {
    const defectTypes: DefectType[] = yield select(
      (state) => state.reference.defectTypes as DefectType[],
    );
    const severities: Severity[] = yield select(
      (state) => state.reference.severities as Severity[],
    );

    const optimistic = buildOptimisticInspection(action.payload, defectTypes, severities);

    // On screen first, persisted second, queued third: the supervisor never waits.
    yield put(createSucceeded(optimistic));
    yield call(putInspection, optimistic);

    yield call(enqueue, {
      opId: crypto.randomUUID(),
      type: 'CREATE',
      inspectionId: action.payload.id,
      payload: action.payload,
    });

    // Publish the queue immediately so the pending badge appears on write, rather than
    // whenever the sync engine next happens to refresh it.
    yield call(publishOutbox);
    yield put(syncRequested());
    yield put(summaryRequested());
  } catch (error) {
    yield put(createFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
}

export function* submitResolve(
  action: PayloadAction<{ id: string; resolutionNote: string }>,
): Generator<unknown, void, any> {
  const { id, resolutionNote } = action.payload;
  const existing: Inspection | null = yield select(selectInspectionById(id));

  // Apply locally first. The server still arbitrates resolve-once — a 409 during the drain
  // means it was already resolved, which the sync engine reconciles rather than reports.
  if (existing) {
    const resolved: Inspection = {
      ...existing,
      status: 'RESOLVED',
      resolutionNote,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    yield put(resolveSucceeded(resolved));
    yield call(putInspection, resolved);
  }

  yield call(enqueue, {
    opId: crypto.randomUUID(),
    type: 'RESOLVE',
    inspectionId: id,
    payload: { resolutionNote },
  });

  yield call(publishOutbox);
  yield put(syncRequested());
  yield put(summaryRequested());
}

export function* inspectionsSaga() {
  // Every action that changes the query re-runs the fetch, and takeLatest cancels the
  // in-flight one — so tapping through filters can never render a stale list.
  yield takeLatest(
    [
      listRequested.type,
      filtersChanged.type,
      filtersCleared.type,
      sortChanged.type,
      pageChanged.type,
    ],
    fetchList,
  );
  // takeLeading on the submits: the first tap wins and a double-tap is ignored. The server
  // enforces both invariants anyway, so correctness never depends on this.
  yield takeLeading(createRequested.type, submitCreate);
  yield takeLeading(resolveRequested.type, submitResolve);
}
