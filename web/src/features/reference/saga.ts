import { all, call, put, takeLatest } from 'redux-saga/effects';
import { getDefectTypes, getSeverities } from '../../api/reference';
import type { ApiSuccess, DefectType, Severity } from '../../api/types';
import { referenceFailed, referenceRequested, referenceSucceeded } from './slice';

function* loadReference() {
  try {
    // Both dropdowns are useless without the other, so fetch them together.
    const [defectTypes, severities]: [ApiSuccess<DefectType[]>, ApiSuccess<Severity[]>] =
      yield all([call(getDefectTypes), call(getSeverities)]);

    yield put(
      referenceSucceeded({ defectTypes: defectTypes.data, severities: severities.data }),
    );
  } catch (error) {
    yield put(referenceFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
}

// takeLatest: it's a fetch, so only the newest answer matters (CLAUDE.md convention).
export function* referenceSaga() {
  yield takeLatest(referenceRequested.type, loadReference);
}
