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
  resolveStatus: 'idle' | 'submitting' | 'failed';
  resolveError: string | null;
  /**
   * A 409 from an *online* resolve means someone else got there first — a real conflict
   * worth telling the user about, unlike the offline replay path where the same status means
   * "my own queued op already landed" (DESIGN.md §5.2).
   */
  resolveConflict: boolean;
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
  resolveStatus: 'idle',
  resolveError: null,
  resolveConflict: false,
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

    resolveRequested(state, _action: PayloadAction<{ id: string; resolutionNote: string }>) {
      state.resolveStatus = 'submitting';
      state.resolveError = null;
      state.resolveConflict = false;
    },
    resolveSucceeded(state, action: PayloadAction<Inspection>) {
      // Replace the row in place so the open list updates without waiting for the refetch.
      const index = state.items.findIndex((item) => item.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
      state.resolveStatus = 'idle';
      state.resolveError = null;
      state.resolveConflict = false;
    },
    resolveConflicted(state) {
      state.resolveStatus = 'failed';
      state.resolveError = 'Already resolved by someone else — refreshing.';
      state.resolveConflict = true;
    },
    resolveFailed(state, action: PayloadAction<string>) {
      state.resolveStatus = 'failed';
      state.resolveError = action.payload;
      state.resolveConflict = false;
    },
    resolveFormReset(state) {
      state.resolveStatus = 'idle';
      state.resolveError = null;
      state.resolveConflict = false;
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
  resolveRequested,
  resolveSucceeded,
  resolveConflicted,
  resolveFailed,
  resolveFormReset,
} = inspectionsSlice.actions;

export const inspectionsReducer = inspectionsSlice.reducer;
