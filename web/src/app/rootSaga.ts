import { all, fork } from 'redux-saga/effects';
import { inspectionsSaga } from '../features/inspections/saga';
import { referenceSaga } from '../features/reference/saga';

// One place that starts every watcher. Feature sagas are forked so one crashing watcher
// can't take the others down with it.
export function* rootSaga() {
  yield all([fork(referenceSaga), fork(inspectionsSaga)]);
}
