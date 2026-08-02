import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import {
  selectInspections,
  selectListError,
  selectListStatus,
  selectPageMeta,
} from '../selectors';
import { listRequested } from '../slice';
import { InspectionCard } from './InspectionCard';

export function InspectionList({ onSelect }: { onSelect: (id: string) => void }) {
  const dispatch = useAppDispatch();
  const inspections = useAppSelector(selectInspections);
  const status = useAppSelector(selectListStatus);
  const error = useAppSelector(selectListError);
  const meta = useAppSelector(selectPageMeta);

  useEffect(() => {
    dispatch(listRequested(1));
  }, [dispatch]);

  if (status === 'loading' && inspections.length === 0) {
    return <p className="p-6 text-center text-slate-500">Loading inspections…</p>;
  }

  if (status === 'failed') {
    return (
      <div className="p-6 text-center">
        <p className="font-medium text-red-700">Couldn’t load inspections</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => dispatch(listRequested())}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (inspections.length === 0) {
    return (
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
            onClick={() => dispatch(listRequested(meta.page - 1))}
            className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.totalPages}
            onClick={() => dispatch(listRequested(meta.page + 1))}
            className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
