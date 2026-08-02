import type { Severity } from '../../../api/types';

// Colour is keyed on the stable business code, with a neutral fallback so a severity added
// to the lookup table later still renders sensibly instead of breaking the card.
const STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  MAJOR: 'bg-amber-100 text-amber-900',
  MINOR: 'bg-slate-100 text-slate-700',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STYLES[severity.code] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {severity.label}
    </span>
  );
}
