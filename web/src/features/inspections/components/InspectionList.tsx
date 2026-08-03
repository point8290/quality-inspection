import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  selectHasActiveFilters,
  selectInspections,
  selectListError,
  selectListStatus,
  selectPageMeta,
} from '../selectors';
import { filtersCleared, listRequested, pageChanged } from '../slice';
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS } from '../../../lib/styles';
import { FilterBar } from './FilterBar';
import { InspectionCard } from './InspectionCard';

function Results({ onSelect }: { onSelect: (id: string) => void }) {
  const dispatch = useAppDispatch();
  const inspections = useAppSelector(selectInspections);
  const status = useAppSelector(selectListStatus);
  const error = useAppSelector(selectListError);
  const meta = useAppSelector(selectPageMeta);
  const hasActiveFilters = useAppSelector(selectHasActiveFilters);

  if (status === 'loading' && inspections.length === 0) {
    return <p className="p-6 text-center text-slate-500">Loading inspections…</p>;
  }

  if (status === 'failed') {
    return (
      <div role="alert" className="p-6 text-center">
        <p className="font-medium text-red-700">Couldn’t load inspections</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => dispatch(listRequested())}
          className={`mt-4 ${BUTTON_PRIMARY_CLASS}`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (inspections.length === 0) {
    // "Nothing matches" and "nothing logged yet" are different problems with different fixes.
    return hasActiveFilters ? (
      <div className="p-6 text-center">
        <p className="font-medium text-slate-700">No inspections match these filters</p>
        <button
          type="button"
          onClick={() => dispatch(filtersCleared())}
          className={`mt-4 ${BUTTON_PRIMARY_CLASS}`}
        >
          Clear filters
        </button>
      </div>
    ) : (
      <div className="p-6 text-center">
        <p className="font-medium text-slate-700">No inspections yet</p>
        <p className="mt-1 text-sm text-slate-500">Tap ＋ to log the first one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {inspections.map((inspection) => (
        <InspectionCard
          key={inspection.id}
          inspection={inspection}
          onSelect={() => onSelect(inspection.id)}
        />
      ))}

      {meta && meta.totalPages > 1 && (
        <nav className="mt-2 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => dispatch(pageChanged(meta.page - 1))}
            className={BUTTON_SECONDARY_CLASS}
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.totalPages}
            onClick={() => dispatch(pageChanged(meta.page + 1))}
            className={BUTTON_SECONDARY_CLASS}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

export function InspectionList({ onSelect }: { onSelect: (id: string) => void }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(listRequested());
  }, [dispatch]);

  return (
    <>
      <FilterBar />
      <Results onSelect={onSelect} />
    </>
  );
}
