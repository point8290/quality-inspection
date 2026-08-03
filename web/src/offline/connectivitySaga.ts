import type { PayloadAction } from '@reduxjs/toolkit';
import { eventChannel } from 'redux-saga';
import { call, put, take, takeEvery } from 'redux-saga/effects';
import { discardDeadLetter, listDeadLetter, listPending } from './outbox';
import {
  deadLetterDiscarded,
  deadLetterLoaded,
  onlineChanged,
  outboxLoaded,
  syncRequested,
} from './slice';

/**
 * Turns the browser's online/offline events into actions. An eventChannel is saga's bridge
 * from a callback API into the effect world — the one place we subscribe to the DOM.
 */
function createConnectivityChannel() {
  return eventChannel<boolean>((emit) => {
    const handleOnline = () => emit(true);
    const handleOffline = () => emit(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });
}

function* watchConnectivity(): Generator<unknown, void, any> {
  const channel = yield call(createConnectivityChannel);

  for (;;) {
    const isOnline: boolean = yield take(channel);
    yield put(onlineChanged(isOnline));

    // Coming back online is the moment the outbox should drain. takeLeading on the sync
    // watcher makes a duplicate event harmless.
    if (isOnline) {
      yield put(syncRequested());
    }
  }
}

/** Loads whatever was left in the queues by a previous session. */
function* hydrateQueues(): Generator<unknown, void, any> {
  const pending = yield call(listPending);
  yield put(outboxLoaded(pending));

  const dead = yield call(listDeadLetter);
  yield put(deadLetterLoaded(dead));
}

export function* offlineBootSaga(): Generator<unknown, void, any> {
  yield put(onlineChanged(navigator.onLine));
  yield call(hydrateQueues);

  // Anything queued when the app was last closed drains on the next open.
  yield put(syncRequested());
  yield call(watchConnectivity);
}

function* discardOne(action: PayloadAction<string>): Generator<unknown, void, any> {
  yield call(discardDeadLetter, action.payload);

  const dead = yield call(listDeadLetter);
  yield put(deadLetterLoaded(dead));
}

export function* deadLetterSaga() {
  yield takeEvery(deadLetterDiscarded.type, discardOne);
}
