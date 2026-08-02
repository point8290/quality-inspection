import { call, put, takeLatest, takeLeading } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { ApiRequestError } from '../../api/client';
import { createInspection, listInspections, resolveInspection } from '../../api/inspections';
import type { ApiSuccess, CreateInspectionPayload, Inspection, PageMeta } from '../../api/types';
import { summaryRequested } from '../summary/slice';
import {
  createFailed,
  createRequested,
  createSucceeded,
  listFailed,
  listRequested,
  listSucceeded,
  resolveConflicted,
  resolveFailed,
  resolveRequested,
  resolveSucceeded,
} from './slice';

function* fetchList(action: PayloadAction<number | undefined>) {
  try {
    const page = action.payload ?? 1;
    const response: ApiSuccess<Inspection[], PageMeta> = yield call(listInspections, page);

    yield put(
      listSucceeded({
        items: response.data,
        // The API always sends meta on the list; this keeps the reducer's type honest.
        meta: response.meta ?? {
          page,
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
    // Re-read rather than splicing the new row in locally: the server is the source of
    // truth for ordering and for the expanded relation labels.
    yield put(listRequested(1));
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
export function* submitResolve(action: PayloadAction<{ id: string; resolutionNote: string }>) {
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
  // takeLatest on the fetch: when pages change quickly, only the newest list matters.
  yield takeLatest(listRequested.type, fetchList);
  // takeLeading on the submits: the first tap wins and a double-tap is ignored. The server
  // enforces both invariants anyway, so correctness never depends on this.
  yield takeLeading(createRequested.type, submitCreate);
  yield takeLeading(resolveRequested.type, submitResolve);
}
