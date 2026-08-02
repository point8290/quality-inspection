import { call, put } from 'redux-saga/effects';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../../api/client';
import { resolveInspection } from '../../api/inspections';
import type { Inspection } from '../../api/types';
import { summaryRequested } from '../summary/slice';
import { submitResolve } from './saga';
import { listRequested, resolveConflicted, resolveRequested, resolveSucceeded } from './slice';

const resolved = {
  id: 'abc',
  status: 'RESOLVED',
  resolutionNote: 'Fixed',
} as unknown as Inspection;

// Sagas are generators, so a test can walk them one effect at a time: no network, no
// mocking library — just assert the plain objects the saga yields.
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
