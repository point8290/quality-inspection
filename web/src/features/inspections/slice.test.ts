import { describe, expect, it } from 'vitest';
import type { Inspection } from '../../api/types';
import {
  filtersChanged,
  filtersCleared,
  inspectionsReducer,
  listSucceeded,
  pageChanged,
  resolveConflicted,
  resolveFailed,
  resolveRequested,
  resolveSucceeded,
  sortChanged,
} from './slice';

function inspection(id: string, overrides: Partial<Inspection> = {}): Inspection {
  return {
    id,
    inspectionDate: '2026-07-15',
    machineId: 'LOOM-04',
    defectType: { code: 'HOLE', label: 'Hole / Tear' },
    severity: { code: 'MAJOR', label: 'Major', rank: 1 },
    remarks: null,
    status: 'OPEN',
    resolutionNote: null,
    resolvedAt: null,
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    ...overrides,
  };
}

const initialState = inspectionsReducer(undefined, { type: '@@INIT' });

function stateWithTwoRows() {
  return inspectionsReducer(
    initialState,
    listSucceeded({
      items: [inspection('a'), inspection('b')],
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    }),
  );
}

describe('inspections reducer — filters, sort and paging', () => {
  it('merges a partial filter change, so each control only sends its own field', () => {
    const withStatus = inspectionsReducer(initialState, filtersChanged({ status: 'OPEN' }));
    const state = inspectionsReducer(withStatus, filtersChanged({ severityCode: 'CRITICAL' }));

    expect(state.filters).toEqual({ status: 'OPEN', severityCode: 'CRITICAL' });
  });

  it('resets to page 1 when a filter changes', () => {
    // Page 3 of the old filter is meaningless under the new one.
    const onPageThree = inspectionsReducer(initialState, pageChanged(3));

    const state = inspectionsReducer(onPageThree, filtersChanged({ status: 'OPEN' }));

    expect(onPageThree.page).toBe(3);
    expect(state.page).toBe(1);
  });

  it('resets to page 1 when the sort changes', () => {
    const onPageThree = inspectionsReducer(initialState, pageChanged(3));

    const state = inspectionsReducer(
      onPageThree,
      sortChanged({ sortBy: 'severity', sortDir: 'asc' }),
    );

    expect(state.page).toBe(1);
    expect(state.sort).toEqual({ sortBy: 'severity', sortDir: 'asc' });
  });

  it('leaves the filters alone when only the page changes', () => {
    const filtered = inspectionsReducer(initialState, filtersChanged({ status: 'OPEN' }));

    const state = inspectionsReducer(filtered, pageChanged(2));

    expect(state.filters).toEqual({ status: 'OPEN' });
    expect(state.page).toBe(2);
  });

  it('clears every filter but keeps the chosen sort', () => {
    const filtered = inspectionsReducer(
      inspectionsReducer(initialState, sortChanged({ sortBy: 'severity', sortDir: 'asc' })),
      filtersChanged({ status: 'OPEN', severityCode: 'CRITICAL' }),
    );

    const state = inspectionsReducer(filtered, filtersCleared());

    expect(state.filters).toEqual({});
    expect(state.page).toBe(1);
    expect(state.sort).toEqual({ sortBy: 'severity', sortDir: 'asc' });
  });

  it('defaults to newest first', () => {
    expect(initialState.sort).toEqual({ sortBy: 'createdAt', sortDir: 'desc' });
  });
});

describe('inspections reducer — resolve', () => {
  it('replaces the resolved row in place and leaves the others alone', () => {
    const resolved = inspection('b', {
      status: 'RESOLVED',
      resolutionNote: 'Re-wove the section',
      resolvedAt: '2026-07-16T10:00:00.000Z',
    });

    const state = inspectionsReducer(stateWithTwoRows(), resolveSucceeded(resolved));

    // Order is preserved — the row updates without the list jumping.
    expect(state.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(state.items[1].status).toBe('RESOLVED');
    expect(state.items[1].resolutionNote).toBe('Re-wove the section');
    expect(state.items[0].status).toBe('OPEN');
  });

  it('ignores a resolved row that is not on the current page', () => {
    const state = inspectionsReducer(
      stateWithTwoRows(),
      resolveSucceeded(inspection('not-listed', { status: 'RESOLVED' })),
    );

    expect(state.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(state.resolveStatus).toBe('idle');
  });

  it('flags a 409 as a conflict, distinctly from an ordinary failure', () => {
    const conflicted = inspectionsReducer(initialState, resolveConflicted());
    const failed = inspectionsReducer(initialState, resolveFailed('Network error'));

    // The UI needs to tell "someone else resolved it" apart from "the request broke".
    expect(conflicted.resolveConflict).toBe(true);
    expect(conflicted.resolveStatus).toBe('failed');
    expect(failed.resolveConflict).toBe(false);
    expect(failed.resolveError).toBe('Network error');
  });

  it('clears a previous error when a new resolve starts', () => {
    const afterFailure = inspectionsReducer(initialState, resolveFailed('Network error'));

    const state = inspectionsReducer(
      afterFailure,
      resolveRequested({ id: 'a', resolutionNote: 'Fixed' }),
    );

    expect(state.resolveStatus).toBe('submitting');
    expect(state.resolveError).toBeNull();
    expect(state.resolveConflict).toBe(false);
  });
});
