import { call, put, takeLatest } from 'redux-saga/effects';
import { getSummary } from '../../api/inspections';
import type { ApiSuccess, Summary } from '../../api/types';
import { summaryFailed, summaryRequested, summarySucceeded } from './slice';

function* fetchSummary() {
  try {
    const response: ApiSuccess<Summary> = yield call(getSummary);
    yield put(summarySucceeded(response.data));
  } catch (error) {
    yield put(summaryFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
}

// takeLatest: a create or a resolve can request this while one is in flight, and only the
// newest counts are worth rendering.
export function* summarySaga() {
  yield takeLatest(summaryRequested.type, fetchSummary);
}
