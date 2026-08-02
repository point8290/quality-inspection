import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import { inspectionsReducer } from '../features/inspections/slice';
import { referenceReducer } from '../features/reference/slice';
import { summaryReducer } from '../features/summary/slice';
import { rootSaga } from './rootSaga';

const sagaMiddleware = createSagaMiddleware();

export const store = configureStore({
  reducer: {
    inspections: inspectionsReducer,
    reference: referenceReducer,
    summary: summaryReducer,
  },
  // thunk is off: saga owns every side effect, so there is exactly one way async happens.
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware),
});

// Must run after the store exists — the middleware needs a dispatch to put actions into.
sagaMiddleware.run(rootSaga);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
