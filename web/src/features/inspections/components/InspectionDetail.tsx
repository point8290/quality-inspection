import { useState } from 'react';
import { useAppSelector } from '../../../app/hooks';
import { formatInspectionDate } from '../../../lib/formatDate';
import { selectInspectionById } from '../selectors';
import { ResolveModal } from './ResolveModal';
import { SeverityBadge } from './SeverityBadge';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/** Timestamps are instants, so they're shown in the device's local time (IST on the floor). */
function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString();
}

export function InspectionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  // Read from the store rather than taking a prop, so the sheet re-renders itself after a
  // resolve or a refetch replaces the row.
  const inspection = useAppSelector(selectInspectionById(id));
  const [isResolving, setIsResolving] = useState(false);

  if (!inspection) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">That inspection is no longer in the list.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {inspection.defectType.label}
            </h2>
            <p className="text-sm text-slate-500">{inspection.machineId}</p>
          </div>
          <SeverityBadge severity={inspection.severity} />
        </div>

        <dl className="mt-4">
          <Row label="Status" value={inspection.status} />
          <Row label="Inspection date" value={formatInspectionDate(inspection.inspectionDate)} />
          <Row label="Logged" value={formatTimestamp(inspection.createdAt)} />
          {inspection.resolvedAt && (
            <Row label="Resolved" value={formatTimestamp(inspection.resolvedAt)} />
          )}
        </dl>

        {inspection.remarks && (
          <div className="mt-4">
            <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">Remarks</h3>
            <p className="mt-1 text-sm text-slate-700">{inspection.remarks}</p>
          </div>
        )}

        {inspection.resolutionNote && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3">
            <h3 className="text-xs font-medium tracking-wide text-emerald-800 uppercase">
              Resolution note
            </h3>
            <p className="mt-1 text-sm text-emerald-900">{inspection.resolutionNote}</p>
          </div>
        )}
      </section>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-3 font-medium"
        >
          Back
        </button>
        {inspection.status === 'OPEN' && (
          <button
            type="button"
            onClick={() => setIsResolving(true)}
            className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 font-medium text-white"
          >
            Resolve
          </button>
        )}
      </div>

      {isResolving && <ResolveModal id={id} onClose={() => setIsResolving(false)} />}
    </div>
  );
}
