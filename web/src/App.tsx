import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { BottomTabs } from './components/BottomTabs';
import type { Tab } from './components/BottomTabs';
import { InspectionDetail } from './features/inspections/components/InspectionDetail';
import { InspectionList } from './features/inspections/components/InspectionList';
import { LogForm } from './features/inspections/components/LogForm';
import { referenceRequested } from './features/reference/slice';
import { SummaryView } from './features/summary/SummaryView';

// Two screens sit behind the tab bar; 'log' and 'detail' are pushed on top of them. One
// union in one component — a router would be a dependency to justify for four screens.
type Screen = 'list' | 'summary' | 'log' | 'detail';

const TITLES: Record<Screen, string> = {
  list: 'Inspections',
  summary: 'Summary',
  log: 'Log inspection',
  detail: 'Inspection',
};

function App() {
  const dispatch = useAppDispatch();
  const referenceStatus = useAppSelector((state) => state.reference.status);
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reference data loads once on app start and feeds every dropdown (DESIGN.md §6).
  useEffect(() => {
    dispatch(referenceRequested());
  }, [dispatch]);

  const isTabScreen = screen === 'list' || screen === 'summary';

  function openDetail(id: string) {
    setSelectedId(id);
    setScreen('detail');
  }

  // `relative` so the floating button and the resolve sheet anchor to the phone-width
  // column rather than the viewport.
  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">{TITLES[screen]}</h1>
      </header>

      <main className="flex-1 overflow-y-auto">
        {screen === 'list' && <InspectionList onSelect={openDetail} />}
        {screen === 'summary' && <SummaryView />}
        {screen === 'log' && <LogForm onDone={() => setScreen('list')} />}
        {screen === 'detail' && selectedId && (
          <InspectionDetail id={selectedId} onBack={() => setScreen('list')} />
        )}
      </main>

      {isTabScreen && (
        <BottomTabs active={screen as Tab} onChange={(tab) => setScreen(tab)} />
      )}

      {screen === 'list' && (
        <button
          type="button"
          onClick={() => setScreen('log')}
          disabled={referenceStatus !== 'ready'}
          className="absolute right-6 bottom-20 h-14 w-14 rounded-full bg-slate-900 text-2xl font-light text-white shadow-lg disabled:opacity-40"
          aria-label="Log an inspection"
        >
          ＋
        </button>
      )}
    </div>
  );
}

export default App;
