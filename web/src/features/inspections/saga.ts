import { call, put, select, takeLatest, takeLeading } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { ApiRequestError } from '../../api/client';
import { createInspection, listInspections, resolveInspection } from '../../api/inspections';
import type {
  ApiSuccess,
  CreateInspectionPayload,
  Inspection,
  ListQuery,
  PageMeta,
} from '../../api/types';
import { summaryRequested } from '../summary/slice';
import { selectListQuery } from './selectors';
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
  resolveConflicted,
  resolveFailed,
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
  } catch (error) {
    yield put(listFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
}

function* submitCreate(action: PayloadAction<CreateInspectionPayload>) {
  try {
    yield call(createInspection, action.payload);
    yield put(createSucceeded());
    // Back to page 1 and re-read, rather than splicing the new row in locally: the server
    // is the source of truth for ordering and for the expanded relation labels.
    yield put(pageChanged(1));
    yield put(summaryRequested());
  } catch (error) {
    const isApiError = error instanceof ApiRequestError;
    yield put(
      createFailed({
        message: error instanceof Error ? error.message : 'Unknown error',
        fieldErrors: isApiError ? (error.details ?? []) : [],
      }),
    );
  }
}

/** Exported so tests can step the generator and assert the effects it yields. */
export function* submitResolve(
  action: PayloadAction<{ id: string; resolutionNote: string }>,
): Generator<unknown, void, any> {
  try {
    const response: ApiSuccess<Inspection> = yield call(
      resolveInspection,
      action.payload.id,
      action.payload.resolutionNote,
    );

    yield put(resolveSucceeded(response.data));
    yield put(summaryRequested());
  } catch (error) {
    // 409 online means another supervisor resolved it first — a real conflict, so we say so
    // and refetch to show *their* note. The offline replay path treats the same status as
    // success, because there it means our own queued op already landed (DESIGN.md §5.2).
    if (error instanceof ApiRequestError && error.status === 409) {
      yield put(resolveConflicted());
      yield put(listRequested());
      yield put(summaryRequested());
      return;
    }

    yield put(resolveFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
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
