import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { DeadLetterOp, OutboxOp } from './db';

type OfflineState = {
  isOnline: boolean;
  /** Mirrored from Dexie so components can render pending state without async reads. */
  pendingOps: OutboxOp[];
  deadLetter: DeadLetterOp[];
  syncStatus: 'idle' | 'syncing' | 'failed';
  lastSyncError: string | null;
};

const initialState: OfflineState = {
  // Assume online until the browser says otherwise; a failed request corrects it.
  isOnline: true,
  pendingOps: [],
  deadLetter: [],
  syncStatus: 'idle',
  lastSyncError: null,
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    onlineChanged(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },

    /** Asks the sync engine to drain. `takeLeading` makes a second ask a no-op. */
    syncRequested() {},
    syncStarted(state) {
      state.syncStatus = 'syncing';
      state.lastSyncError = null;
    },
    syncSucceeded(state) {
      state.syncStatus = 'idle';
      state.lastSyncError = null;
    },
    syncFailed(state, action: PayloadAction<string>) {
      state.syncStatus = 'failed';
      state.lastSyncError = action.payload;
    },

    /** Re-read from Dexie after every change, so Redux and the outbox can't drift. */
    outboxLoaded(state, action: PayloadAction<OutboxOp[]>) {
      state.pendingOps = action.payload;
    },
    deadLetterLoaded(state, action: PayloadAction<DeadLetterOp[]>) {
      state.deadLetter = action.payload;
    },
    deadLetterDiscarded(_state, _action: PayloadAction<string>) {},
  },
});

export const {
  onlineChanged,
  syncRequested,
  syncStarted,
  syncSucceeded,
  syncFailed,
  outboxLoaded,
  deadLetterLoaded,
  deadLetterDiscarded,
} = offlineSlice.actions;

export const offlineReducer = offlineSlice.reducer;
