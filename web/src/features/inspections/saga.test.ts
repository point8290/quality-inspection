import { call, put, select } from 'redux-saga/effects';
import { describe, expect, it } from 'vitest';
import { listInspections } from '../../api/inspections';
import type { Inspection, ListQuery } from '../../api/types';
import { enqueue } from '../../offline/outbox';
import { syncRequested } from '../../offline/slice';
import { fetchList, submitCreate, submitResolve } from './saga';
import { selectListQuery } from './selectors';
import {
  createRequested,
  createSucceeded,
  listSucceeded,
  resolveRequested,
  resolveSucceeded,
} from './slice';

// Sagas are generators, so a test can walk them one effect at a time: no network, no
// mocking library — just assert the plain objects the saga yields.

/** Runs a saga to completion and returns every effect it yielded, in order. */
function collectEffects(saga: Generator<unknown, void, any>) {
  const effects: unknown[] = [];
  let step = saga.next();

  while (!step.done) {
    effects.push(step.value);
    // Feed back an empty array: enough for the `select`s these sagas make.
    step = saga.next([]);
  }

  return effects;
}

/** The action types the saga `put`, so assertions don't depend on effect ordering. */
function putActionTypes(effects: unknown[]) {
  return effects
    .map((effect) => (effect as { payload?: { action?: { type?: string } } })?.payload?.action?.type)
    .filter(Boolean);
}

/** The op objects passed to `enqueue`, found by function identity rather than position. */
function enqueuedOps(saga: Generator<unknown, void, any>) {
  return collectEffects(saga)
    .filter((effect) => (effect as { payload?: { fn?: unknown } })?.payload?.fn === enqueue)
    .map((effect) => (effect as { payload: { args: unknown[] } }).payload.args[0]);
}

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
  });
});

/**
 * Every write goes through the outbox — there is no online/offline branch. Online is just
 * the case where the drain happens immediately (DESIGN.md §5.2). One write path means a
 * connection that drops between a check and a request can't produce a lost write.
 */
describe('submitCreate saga — always through the outbox', () => {
  const payload = {
    id: 'client-minted-uuid',
    inspectionDate: '2026-08-03',
    machineId: 'LOOM-04',
    defectTypeCode: 'HOLE',
    severityCode: 'MAJOR',
  };

  it('never calls the API directly', () => {
    const calledFunctions = collectEffects(submitCreate(createRequested(payload)))
      .map((effect) => (effect as { payload?: { fn?: { name?: string } } })?.payload?.fn?.name)
      .filter(Boolean);

    // The sync engine owns the network. If a component's write could reach the API without
    // passing through the outbox, an offline write would be silently lost.
    expect(calledFunctions).not.toContain('createInspection');
    expect(calledFunctions).toContain('enqueue');
  });

  it('enqueues a CREATE op keyed on the client-minted id', () => {
    const enqueued = enqueuedOps(submitCreate(createRequested(payload)));

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      type: 'CREATE',
      inspectionId: 'client-minted-uuid',
      payload,
    });
  });

  it('shows the row optimistically and asks the sync engine to drain', () => {
    const effects = collectEffects(submitCreate(createRequested(payload)));

    expect(putActionTypes(effects)).toContain(createSucceeded.type);
    expect(effects).toContainEqual(put(syncRequested()));
  });
});

describe('submitResolve saga — always through the outbox', () => {
  const action = resolveRequested({ id: 'abc', resolutionNote: 'Re-wove the section' });

  it('enqueues a RESOLVE op and asks the sync engine to drain', () => {
    const enqueued = enqueuedOps(submitResolve(action));

    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]).toMatchObject({
      type: 'RESOLVE',
      inspectionId: 'abc',
      payload: { resolutionNote: 'Re-wove the section' },
    });
    expect(collectEffects(submitResolve(action))).toContainEqual(put(syncRequested()));
  });

  it('marks the inspection resolved locally without waiting for the server', () => {
    // The server still arbitrates resolve-once; a 409 during the drain is reconciled by the
    // sync engine rather than reported to the user.
    const saga = submitResolve(action);
    const existing = { id: 'abc', status: 'OPEN' } as Inspection;

    const effects: unknown[] = [];
    let step = saga.next();
    while (!step.done) {
      effects.push(step.value);
      step = saga.next(existing);
    }

    expect(putActionTypes(effects)).toContain(resolveSucceeded.type);
  });
});

/** Kept as a type-level guard that the optimistic row is a real Inspection. */
export type OptimisticRow = Inspection;
