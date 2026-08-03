import type { RootState } from '../app/store';

export const selectIsOnline = (state: RootState) => state.offline.isOnline;
export const selectPendingOps = (state: RootState) => state.offline.pendingOps;
export const selectPendingCount = (state: RootState) => state.offline.pendingOps.length;
export const selectDeadLetter = (state: RootState) => state.offline.deadLetter;
export const selectSyncStatus = (state: RootState) => state.offline.syncStatus;

/**
 * Derived from the outbox rather than stored as a flag on the mirrored row. One source of
 * truth: an inspection is pending exactly while an op for it is queued, so the badge can't
 * go stale after a sync.
 */
export const selectIsPending = (inspectionId: string) => (state: RootState) =>
  state.offline.pendingOps.some((op) => op.inspectionId === inspectionId);
