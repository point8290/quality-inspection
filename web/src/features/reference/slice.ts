import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DefectType, Severity } from '../../api/types';

type ReferenceState = {
  defectTypes: DefectType[];
  severities: Severity[];
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error: string | null;
};

const initialState: ReferenceState = {
  defectTypes: [],
  severities: [],
  status: 'idle',
  error: null,
};

/**
 * Reference data is loaded once on app start and feeds every dropdown, so the UI never
 * hardcodes a defect type or severity — the lookup tables stay the one source of truth.
 */
const referenceSlice = createSlice({
  name: 'reference',
  initialState,
  reducers: {
    referenceRequested(state) {
      state.status = 'loading';
      state.error = null;
    },
    referenceSucceeded(
      state,
      action: PayloadAction<{ defectTypes: DefectType[]; severities: Severity[] }>,
    ) {
      state.defectTypes = action.payload.defectTypes;
      state.severities = action.payload.severities;
      state.status = 'ready';
      state.error = null;
    },
    referenceFailed(state, action: PayloadAction<string>) {
      state.status = 'failed';
      state.error = action.payload;
    },
  },
});

export const { referenceRequested, referenceSucceeded, referenceFailed } = referenceSlice.actions;
export const referenceReducer = referenceSlice.reducer;
