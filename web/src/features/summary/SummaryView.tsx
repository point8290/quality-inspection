import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { BUTTON_PRIMARY_CLASS } from '../../lib/styles';
import { summaryRequested } from './slice';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-center">
      <p className="text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
    </div>
  );
}

export function SummaryView() {
  const dispatch = useAppDispatch();
  const { summary, status, error } = useAppSelector((state) => state.summary);
  // Labels and ordering come from the reference data — the summary payload is codes only.
  const severities = useAppSelector((state) => state.reference.severities);

  useEffect(() => {
    dispatch(summaryRequested());
  }, [dispatch]);

  if (status === 'loading' && !summary) {
    return <p className="p-6 text-center text-slate-500">Loading summary…</p>;
  }

  if (status === 'failed') {
    return (
      <div role="alert" className="p-6 text-center">
        <p className="font-medium text-red-700">Couldn’t load the summary</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => dispatch(summaryRequested())}
          className={`mt-4 ${BUTTON_PRIMARY_CLASS}`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex gap-3">
        <StatTile label="Open" value={summary.byStatus.OPEN} />
        <StatTile label="Resolved" value={summary.byStatus.RESOLVED} />
        <StatTile label="Total" value={summary.total} />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
              <th className="px-4 py-2 font-medium">Severity</th>
              <th className="px-4 py-2 text-right font-medium">Open</th>
              <th className="px-4 py-2 text-right font-medium">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {severities.map((severity) => {
              const counts = summary.bySeverity[severity.code] ?? { OPEN: 0, RESOLVED: 0 };

              return (
                <tr key={severity.code} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{severity.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{counts.OPEN}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{counts.RESOLVED}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
