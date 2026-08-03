import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { BottomTabs } from './components/BottomTabs';
import type { Tab } from './components/BottomTabs';
import { ErrorBanner } from './components/ErrorBanner';
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
  const referenceError = useAppSelector((state) => state.reference.error);
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reference data loads once on app start and feeds every dropdown (DESIGN.md §6).
  useEffect(() => {
    dispatch(referenceRequested());
  }, [dispatch]);

  const isTabScreen = screen === 'list' || screen === 'summary';
  const isReferenceBroken = referenceStatus === 'failed';

  function openDetail(id: string) {
    setSelectedId(id);
    setScreen('detail');
  }

  // `relative` so the floating button and the resolve sheet anchor to the phone-width
  // column rather than the viewport; `overflow-hidden` keeps the scroll inside <main>.
  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col overflow-hidden bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">{TITLES[screen]}</h1>
      </header>

      {/*
        Deliberately not dismissable. Losing reference data breaks the whole app — both
        dropdowns depend on it and ＋ is disabled — so a dismissable banner would just
        restore the silent dead-end it exists to explain. It clears itself on a successful
        retry.
      */}
      {isReferenceBroken && (
        <ErrorBanner
          message="Can’t load defect types and severities"
          detail={referenceError ?? 'Logging a new inspection is unavailable until this loads.'}
          onRetry={() => dispatch(referenceRequested())}
        />
      )}

      <main className="flex-1 overflow-y-auto overscroll-contain">
        {screen === 'list' && <InspectionList onSelect={openDetail} />}
        {screen === 'summary' && <SummaryView />}
        {screen === 'log' && <LogForm onDone={() => setScreen('list')} />}
        {screen === 'detail' && selectedId && (
          <InspectionDetail id={selectedId} onBack={() => setScreen('list')} />
        )}
      </main>

      {isTabScreen && <BottomTabs active={screen as Tab} onChange={(tab) => setScreen(tab)} />}

      {screen === 'list' && (
        <button
          type="button"
          onClick={() => setScreen('log')}
          disabled={referenceStatus !== 'ready'}
          // Sits above the tab bar and clear of the home indicator.
          className="absolute right-5 h-14 w-14 rounded-full bg-slate-900 text-2xl font-light text-white shadow-lg disabled:opacity-40"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          aria-label="Log an inspection"
        >
          ＋
        </button>
      )}
    </div>
  );
}

export default App;
