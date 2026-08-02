import { call, put, select } from 'redux-saga/effects';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../api/client';
import { listInspections, resolveInspection } from '../../api/inspections';
import type { Inspection, ListQuery } from '../../api/types';
import { summaryRequested } from '../summary/slice';
import { fetchList, submitResolve } from './saga';
import { selectListQuery } from './selectors';
import {
  listRequested,
  listSucceeded,
  resolveConflicted,
  resolveRequested,
  resolveSucceeded,
} from './slice';

const resolved = {
  id: 'abc',
  status: 'RESOLVED',
  resolutionNote: 'Fixed',
} as unknown as Inspection;

// Sagas are generators, so a test can walk them one effect at a time: no network, no
// mocking library — just assert the plain objects the saga yields.
describe('fetchList saga', () => {
  const query: ListQuery = {
    page: 2,
    status: 'OPEN',
    severityCode: 'CRITICAL',
    sortBy: 'severity',
    sortDir: 'asc',
  };

  it('reads the composed query from state and sends it to the API', () => {
    const saga = fetchList();

    // The reducer has already applied the filter change, so the saga never has to
    // reassemble the query from an action payload.
    expect(saga.next().value).toEqual(select(selectListQuery));
    expect(saga.next(query).value).toEqual(call(listInspections, query));
  });

  it('stores the rows together with the pagination meta', () => {
    const saga = fetchList();
    saga.next();
    saga.next(query);

    const meta = { page: 2, pageSize: 20, total: 40, totalPages: 2 };
    const effect = saga.next({ data: [], meta });

    expect(effect.value).toEqual(put(listSucceeded({ items: [], meta })));
    expect(saga.next().done).toBe(true);
  });
});

describe('submitResolve saga', () => {
  it('calls the API, then updates the row and refreshes the summary', () => {
    const saga = submitResolve(resolveRequested({ id: 'abc', resolutionNote: 'Fixed' }));

    expect(saga.next().value).toEqual(call(resolveInspection, 'abc', 'Fixed'));
    expect(saga.next({ data: resolved }).value).toEqual(put(resolveSucceeded(resolved)));
    expect(saga.next().value).toEqual(put(summaryRequested()));
    expect(saga.next().done).toBe(true);
  });

  it('treats an online 409 as a surfaced conflict and refetches', () => {
    const saga = submitResolve(resolveRequested({ id: 'abc', resolutionNote: 'Fixed' }));
    saga.next();

    const conflict = new ApiRequestError(409, 'ALREADY_RESOLVED', 'Already resolved');

    // Online, someone else got there first — say so and reload to show *their* note.
    // The offline replay path will treat the same status as success (DESIGN.md §5.2).
    expect(saga.throw(conflict).value).toEqual(put(resolveConflicted()));
    expect(saga.next().value).toEqual(put(listRequested()));
    expect(saga.next().value).toEqual(put(summaryRequested()));
    expect(saga.next().done).toBe(true);
  });

  it('does not report success when the resolve fails', () => {
    const saga = submitResolve(resolveRequested({ id: 'abc', resolutionNote: 'Fixed' }));
    saga.next();

    const effect = saga.throw(new ApiRequestError(500, 'INTERNAL_ERROR', 'Server error'));

    expect(effect.value).not.toEqual(put(resolveSucceeded(resolved)));
    expect(saga.next().done).toBe(true);
  });
});
