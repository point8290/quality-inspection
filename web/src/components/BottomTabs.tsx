export type Tab = 'list' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'summary', label: 'Summary' },
];

export function BottomTabs({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav
      className="flex shrink-0 border-t border-slate-200 bg-white"
      // Keeps the tabs clear of the home indicator on a notched phone.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
          // slate-500, not slate-400: slate-400 on white is ~2.8:1, under the 4.5:1 the
          // WCAG AA floor asks for on small text.
          className={`min-h-14 flex-1 py-4 text-sm font-medium ${
            active === tab.id ? 'text-slate-900' : 'text-slate-500'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
