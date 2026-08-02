import { useState } from 'react';
import type { InspectionSort, SortBy, SortDir } from '../../../api/types';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectFilters, selectHasActiveFilters, selectSort } from '../selectors';
import { filtersChanged, filtersCleared, sortChanged } from '../slice';

/**
 * sortDir means the same thing on every column — including severity, where it applies to
 * rank — so the options are labelled here rather than exposing raw asc/desc to a supervisor.
 */
const SORT_OPTIONS: { label: string; value: string; sort: InspectionSort }[] = [
  { label: 'Newest first', value: 'createdAt:desc', sort: { sortBy: 'createdAt', sortDir: 'desc' } },
  { label: 'Oldest first', value: 'createdAt:asc', sort: { sortBy: 'createdAt', sortDir: 'asc' } },
  {
    label: 'Inspection date ↓',
    value: 'inspectionDate:desc',
    sort: { sortBy: 'inspectionDate', sortDir: 'desc' },
  },
  {
    label: 'Inspection date ↑',
    value: 'inspectionDate:asc',
    sort: { sortBy: 'inspectionDate', sortDir: 'asc' },
  },
  {
    label: 'Most severe first',
    value: 'severity:asc',
    sort: { sortBy: 'severity', sortDir: 'asc' },
  },
  {
    label: 'Least severe first',
    value: 'severity:desc',
    sort: { sortBy: 'severity', sortDir: 'desc' },
  },
];

const SELECT_CLASS = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export function FilterBar() {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const sort = useAppSelector(selectSort);
  const hasActiveFilters = useAppSelector(selectHasActiveFilters);
  const { defectTypes, severities } = useAppSelector((state) => state.reference);
  const [isOpen, setIsOpen] = useState(false);

  const activeCount = Object.values(filters).filter((value) => value !== undefined && value !== '')
    .length;

  // An empty select means "no filter", which the API reads as the param being absent.
  const set = (patch: Parameters<typeof filtersChanged>[0]) => dispatch(filtersChanged(patch));

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
          aria-expanded={isOpen}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>

        <select
          aria-label="Sort by"
          value={`${sort.sortBy}:${sort.sortDir}`}
          onChange={(event) => {
            const [sortBy, sortDir] = event.target.value.split(':');
            dispatch(sortChanged({ sortBy: sortBy as SortBy, sortDir: sortDir as SortDir }));
          }}
          className={SELECT_CLASS}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isOpen && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-3">
          <label className="col-span-2 text-xs font-medium text-slate-500">
            Status
            <select
              value={filters.status ?? ''}
              onChange={(event) =>
                set({ status: (event.target.value || undefined) as 'OPEN' | 'RESOLVED' | undefined })
              }
              className={SELECT_CLASS}
            >
              <option value="">Any</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </label>

          <label className="text-xs font-medium text-slate-500">
            Severity
            <select
              value={filters.severityCode ?? ''}
              onChange={(event) => set({ severityCode: event.target.value || undefined })}
              className={SELECT_CLASS}
            >
              <option value="">Any</option>
              {severities.map((severity) => (
                <option key={severity.code} value={severity.code}>
                  {severity.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-500">
            Defect type
            <select
              value={filters.defectTypeCode ?? ''}
              onChange={(event) => set({ defectTypeCode: event.target.value || undefined })}
              className={SELECT_CLASS}
            >
              <option value="">Any</option>
              {defectTypes.map((defectType) => (
                <option key={defectType.code} value={defectType.code}>
                  {defectType.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-500">
            From
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(event) => set({ dateFrom: event.target.value || undefined })}
              className={SELECT_CLASS}
            />
          </label>

          <label className="text-xs font-medium text-slate-500">
            To
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(event) => set({ dateTo: event.target.value || undefined })}
              className={SELECT_CLASS}
            />
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => dispatch(filtersCleared())}
              className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
