import { all, call, put, takeLatest } from 'redux-saga/effects';
import { getDefectTypes, getSeverities } from '../../api/reference';
import type { ApiSuccess, DefectType, Severity } from '../../api/types';
import type { ReferenceSnapshot } from '../../offline/db';
import { putReference, readReference } from '../../offline/mirror';
import { referenceFailed, referenceRequested, referenceSucceeded } from './slice';

function* loadReference(): Generator<unknown, void, any> {
  try {
    // Both dropdowns are useless without the other, so fetch them together.
    const [defectTypes, severities]: [ApiSuccess<DefectType[]>, ApiSuccess<Severity[]>] =
      yield all([call(getDefectTypes), call(getSeverities)]);

    const snapshot: ReferenceSnapshot = {
      defectTypes: defectTypes.data,
      severities: severities.data,
    };

    yield put(referenceSucceeded(snapshot));
    // Cached so the log form still has its dropdowns on a cold, offline start.
    yield call(putReference, snapshot);
  } catch (error) {
    const cached: { value: ReferenceSnapshot } | undefined = yield call(readReference);

    // Falling back to the cache turns "the app is unusable" into "the app works offline".
    if (cached) {
      yield put(referenceSucceeded(cached.value));
      return;
    }

    yield put(referenceFailed(error instanceof Error ? error.message : 'Unknown error'));
  }
}

// takeLatest: it's a fetch, so only the newest answer matters (CLAUDE.md convention).
export function* referenceSaga() {
  yield takeLatest(referenceRequested.type, loadReference);
}
