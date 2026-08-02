import { call, put, takeLatest, takeLeading } from 'redux-saga/effects';
import type { PayloadAction } from '@reduxjs/toolkit';
import { ApiRequestError } from '../../api/client';
import { createInspection, listInspections } from '../../api/inspections';
import type { ApiSuccess, CreateInspectionPayload, Inspection, PageMeta } from '../../api/types';
import {
  createFailed,
  createRequested,
  createSucceeded,
  listFailed,
  listRequested,
  listSucceeded,
} from './slice';

function* fetchList(action: PayloadAction<number | undefined>) {
  try {
    const page = action.payload ?? 1;
    const response: ApiSuccess<Inspection[], PageMeta> = yield call(listInspections, page);

    yield put(
      listSucceeded({
        items: response.data,
        // The API always sends meta on the list; this keeps the reducer's type honest.
        meta: response.meta ?? { page, pageSize: response.data.length, total: response.data.length, totalPages: 1 },
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

export function* inspectionsSaga() {
  // takeLatest on the fetch: when pages change quickly, only the newest list matters.
  yield takeLatest(listRequested.type, fetchList);
  // takeLeading on the submit: the first tap wins and a double-tap is ignored.
  yield takeLeading(createRequested.type, submitCreate);
}
