import type { Inspection } from '../../../api/types';
import { formatInspectionDate } from '../../../lib/formatDate';
import { SeverityBadge } from './SeverityBadge';

export function InspectionCard({ inspection }: { inspection: Inspection }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{inspection.defectType.label}</h3>
          <p className="text-sm text-slate-500">{inspection.machineId}</p>
        </div>
        <SeverityBadge severity={inspection.severity} />
      </div>

      {inspection.remarks && (
        <p className="mt-3 text-sm text-slate-600">{inspection.remarks}</p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <time dateTime={inspection.inspectionDate}>
          {formatInspectionDate(inspection.inspectionDate)}
        </time>
        <span
          className={`rounded px-2 py-0.5 font-medium ${
            inspection.status === 'OPEN'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {inspection.status}
        </span>
      </div>
    </article>
  );
}
