import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Summary } from '../../api/types';

type SummaryState = {
  summary: Summary | null;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
};

const initialState: SummaryState = {
  summary: null,
  status: 'idle',
  error: null,
};

const summarySlice = createSlice({
  name: 'summary',
  initialState,
  reducers: {
    summaryRequested(state) {
      state.status = 'loading';
      state.error = null;
    },
    summarySucceeded(state, action: PayloadAction<Summary>) {
      state.summary = action.payload;
      state.status = 'ready';
      state.error = null;
    },
    summaryFailed(state, action: PayloadAction<string>) {
      state.status = 'failed';
      state.error = action.payload;
    },
  },
});

export const { summaryRequested, summarySucceeded, summaryFailed } = summarySlice.actions;
export const summaryReducer = summarySlice.reducer;
