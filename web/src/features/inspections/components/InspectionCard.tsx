import type { Inspection } from '../../../api/types';
import { formatInspectionDate } from '../../../lib/formatDate';
import { SeverityBadge } from './SeverityBadge';

export function InspectionCard({
  inspection,
  onSelect,
}: {
  inspection: Inspection;
  onSelect: () => void;
}) {
  return (
    // A button, not a div with onClick — the whole card is one keyboard-reachable target.
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        {/* min-w-0 lets the flex child shrink so long text wraps instead of overflowing. */}
        <div className="min-w-0">
          <h3 className="font-semibold wrap-break-word text-slate-900">
            {inspection.defectType.label}
          </h3>
          <p className="text-sm wrap-break-word text-slate-500">{inspection.machineId}</p>
        </div>
        <SeverityBadge severity={inspection.severity} />
      </div>

      {inspection.remarks && (
        <p className="mt-3 line-clamp-2 text-sm wrap-break-word text-slate-600">{inspection.remarks}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <time dateTime={inspection.inspectionDate}>
          {formatInspectionDate(inspection.inspectionDate)}
        </time>
        <span
          className={`shrink-0 rounded px-2 py-0.5 font-medium ${
            inspection.status === 'OPEN'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {inspection.status}
        </span>
      </div>
    </button>
  );
}
