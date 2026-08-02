import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type {
  ApiErrorDetail,
  CreateInspectionPayload,
  Inspection,
  InspectionFilters,
  InspectionSort,
  PageMeta,
} from '../../api/types';

/** Newest first: what a supervisor wants to see on arriving at the list. */
const DEFAULT_SORT: InspectionSort = { sortBy: 'createdAt', sortDir: 'desc' };

type InspectionsState = {
  items: Inspection[];
  meta: PageMeta | null;
  page: number;
  filters: InspectionFilters;
  sort: InspectionSort;
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
  filters: {},
  sort: DEFAULT_SORT,
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
    // Any of these four actions changes the query, and the saga watches all of them — so
    // "refetch the list" is never something a component has to remember to dispatch.
    listRequested(state) {
      state.listStatus = 'loading';
      state.listError = null;
    },
    filtersChanged(state, action: PayloadAction<InspectionFilters>) {
      // Merged, so a filter bar control only has to send the field it owns.
      state.filters = { ...state.filters, ...action.payload };
      // Page 3 of the old filter is meaningless under the new one.
      state.page = 1;
      state.listStatus = 'loading';
      state.listError = null;
    },
    filtersCleared(state) {
      state.filters = {};
      state.page = 1;
      state.listStatus = 'loading';
      state.listError = null;
    },
    sortChanged(state, action: PayloadAction<InspectionSort>) {
      state.sort = action.payload;
      state.page = 1;
      state.listStatus = 'loading';
      state.listError = null;
    },
    pageChanged(state, action: PayloadAction<number>) {
      state.page = action.payload;
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
  filtersChanged,
  filtersCleared,
  sortChanged,
  pageChanged,
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
