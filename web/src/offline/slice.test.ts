import { describe, expect, it } from 'vitest';
import type { RootState } from '../app/store';
import type { DeadLetterOp, OutboxOp } from './db';
import {
  selectDeadLetter,
  selectIsOnline,
  selectIsPending,
  selectPendingCount,
} from './selectors';
import { deadLetterLoaded, offlineReducer, onlineChanged, outboxLoaded } from './slice';

const initialState = offlineReducer(undefined, { type: '@@INIT' });

function asRootState(offline: ReturnType<typeof offlineReducer>) {
  return { offline } as RootState;
}

function pendingCreate(inspectionId: string): OutboxOp {
  return {
    seq: 1,
    opId: 'op-1',
    type: 'CREATE',
    inspectionId,
    payload: {
      id: inspectionId,
      inspectionDate: '2026-08-03',
      machineId: 'LOOM-04',
      defectTypeCode: 'HOLE',
      severityCode: 'MAJOR',
    },
  };
}

const rejected: DeadLetterOp = {
  opId: 'op-9',
  type: 'CREATE',
  inspectionId: 'insp-9',
  reason: 'Unknown defect type code',
  failedAt: '2026-08-03T09:00:00.000Z',
};

describe('offline reducer', () => {
  it('assumes online until the browser says otherwise', () => {
    expect(initialState.isOnline).toBe(true);
  });

  it('tracks connectivity changes', () => {
    const offline = offlineReducer(initialState, onlineChanged(false));
    const backOnline = offlineReducer(offline, onlineChanged(true));

    expect(offline.isOnline).toBe(false);
    expect(backOnline.isOnline).toBe(true);
  });

  it('mirrors the outbox out of Dexie', () => {
    const state = offlineReducer(initialState, outboxLoaded([pendingCreate('insp-1')]));

    expect(selectPendingCount(asRootState(state))).toBe(1);
  });
});

describe('selectIsPending', () => {
  it('is true while an op for that inspection is queued', () => {
    const state = offlineReducer(initialState, outboxLoaded([pendingCreate('insp-1')]));

    expect(selectIsPending('insp-1')(asRootState(state))).toBe(true);
    expect(selectIsPending('insp-2')(asRootState(state))).toBe(false);
  });

  it('stops being pending as soon as the op leaves the outbox', () => {
    // Derived from the outbox rather than stored as a flag on the row — which is exactly
    // why it can't get stuck showing "pending" after a successful sync.
    const queued = offlineReducer(initialState, outboxLoaded([pendingCreate('insp-1')]));
    const drained = offlineReducer(queued, outboxLoaded([]));

    expect(selectIsPending('insp-1')(asRootState(queued))).toBe(true);
    expect(selectIsPending('insp-1')(asRootState(drained))).toBe(false);
    expect(selectPendingCount(asRootState(drained))).toBe(0);
  });
});

describe('dead letter', () => {
  it('starts empty and surfaces rejected ops', () => {
    const state = offlineReducer(initialState, deadLetterLoaded([rejected]));

    expect(selectDeadLetter(asRootState(initialState))).toEqual([]);
    expect(selectDeadLetter(asRootState(state))).toHaveLength(1);
    expect(selectDeadLetter(asRootState(state))[0].reason).toBe('Unknown defect type code');
  });

  it('is independent of connectivity', () => {
    // A rejected change is not an offline problem — it stays visible once back online,
    // because retrying will never fix it.
    const withDeadLetter = offlineReducer(initialState, deadLetterLoaded([rejected]));
    const online = offlineReducer(withDeadLetter, onlineChanged(true));

    expect(selectIsOnline(asRootState(online))).toBe(true);
    expect(selectDeadLetter(asRootState(online))).toHaveLength(1);
  });
});
