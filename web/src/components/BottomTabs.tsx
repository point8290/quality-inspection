export type Tab = 'list' | 'summary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'summary', label: 'Summary' },
];

export function BottomTabs({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <nav className="flex border-t border-slate-200 bg-white">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
          // Tall enough to be a comfortable thumb target at 390px.
          className={`flex-1 py-4 text-sm font-medium ${
            active === tab.id ? 'text-slate-900' : 'text-slate-400'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
