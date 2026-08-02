import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { ApiErrorDetail, CreateInspectionPayload, Inspection, PageMeta } from '../../api/types';

type InspectionsState = {
  items: Inspection[];
  meta: PageMeta | null;
  page: number;
  listStatus: 'idle' | 'loading' | 'ready' | 'failed';
  listError: string | null;
  createStatus: 'idle' | 'submitting' | 'failed';
  createError: string | null;
  /** Per-field messages straight from the server's 400 envelope, keyed by field path. */
  createFieldErrors: ApiErrorDetail[];
};

const initialState: InspectionsState = {
  items: [],
  meta: null,
  page: 1,
  listStatus: 'idle',
  listError: null,
  createStatus: 'idle',
  createError: null,
  createFieldErrors: [],
};

const inspectionsSlice = createSlice({
  name: 'inspections',
  initialState,
  reducers: {
    listRequested(state, action: PayloadAction<number | undefined>) {
      state.page = action.payload ?? state.page;
      state.listStatus = 'loading';
      state.listError = null;
    },
    listSucceeded(state, action: PayloadAction<{ items: Inspection[]; meta: PageMeta }>) {
      state.items = action.payload.items;
      state.meta = action.payload.meta;
      state.listStatus = 'ready';
      state.listError = null;
    },
    listFailed(state, action: PayloadAction<string>) {
      state.listStatus = 'failed';
      state.listError = action.payload;
    },

    // The payload is the whole create body — the saga is what talks to the network.
    createRequested(state, _action: PayloadAction<CreateInspectionPayload>) {
      state.createStatus = 'submitting';
      state.createError = null;
      state.createFieldErrors = [];
    },
    createSucceeded(state) {
      state.createStatus = 'idle';
      state.createError = null;
      state.createFieldErrors = [];
    },
    createFailed(
      state,
      action: PayloadAction<{ message: string; fieldErrors: ApiErrorDetail[] }>,
    ) {
      state.createStatus = 'failed';
      state.createError = action.payload.message;
      state.createFieldErrors = action.payload.fieldErrors;
    },
    createFormReset(state) {
      state.createStatus = 'idle';
      state.createError = null;
      state.createFieldErrors = [];
    },
  },
});

export const {
  listRequested,
  listSucceeded,
  listFailed,
  createRequested,
  createSucceeded,
  createFailed,
  createFormReset,
} = inspectionsSlice.actions;

export const inspectionsReducer = inspectionsSlice.reducer;
