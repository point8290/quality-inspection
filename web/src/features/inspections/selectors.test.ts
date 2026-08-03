import { describe, expect, it } from 'vitest';
import type { RootState } from '../../app/store';
import { selectHasActiveFilters, selectListQuery } from './selectors';
import { filtersChanged, inspectionsReducer, pageChanged, sortChanged } from './slice';

const initialState = inspectionsReducer(undefined, { type: '@@INIT' });

/** The selectors only read the inspections slice, so the rest of the store isn't needed. */
function asRootState(inspections: ReturnType<typeof inspectionsReducer>) {
  return { inspections } as RootState;
}

describe('selectHasActiveFilters', () => {
  it('is false when nothing is filtered', () => {
    expect(selectHasActiveFilters(asRootState(initialState))).toBe(false);
  });

  it('is false when a filter has been set back to unset', () => {
    // Clearing a select sends `undefined` rather than deleting the key, so the selector has
    // to look at values — otherwise the empty state would claim filters are active.
    const state = inspectionsReducer(initialState, filtersChanged({ status: undefined }));

    expect(selectHasActiveFilters(asRootState(state))).toBe(false);
  });

  it('is true as soon as one filter is set', () => {
    const state = inspectionsReducer(initialState, filtersChanged({ severityCode: 'CRITICAL' }));

    expect(selectHasActiveFilters(asRootState(state))).toBe(true);
  });
});

describe('selectListQuery', () => {
  it('composes filters, sort and page into one request query', () => {
    const state = inspectionsReducer(
      inspectionsReducer(
        inspectionsReducer(initialState, filtersChanged({ status: 'OPEN' })),
        sortChanged({ sortBy: 'severity', sortDir: 'asc' }),
      ),
      pageChanged(3),
    );

    expect(selectListQuery(asRootState(state))).toEqual({
      status: 'OPEN',
      sortBy: 'severity',
      sortDir: 'asc',
      page: 3,
    });
  });

  it('defaults to page 1, newest first, with no filters', () => {
    expect(selectListQuery(asRootState(initialState))).toEqual({
      sortBy: 'createdAt',
      sortDir: 'desc',
      page: 1,
    });
  });
});
