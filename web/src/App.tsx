import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './app/hooks';
import { InspectionList } from './features/inspections/components/InspectionList';
import { LogForm } from './features/inspections/components/LogForm';
import { referenceRequested } from './features/reference/slice';

type Screen = 'list' | 'log';

function App() {
  const dispatch = useAppDispatch();
  const referenceStatus = useAppSelector((state) => state.reference.status);
  const [screen, setScreen] = useState<Screen>('list');

  // Reference data loads once on app start and feeds every dropdown (DESIGN.md §6).
  useEffect(() => {
    dispatch(referenceRequested());
  }, [dispatch]);

  // `relative` so the floating button anchors to the phone-width column, not the viewport.
  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">
          {screen === 'list' ? 'Inspections' : 'Log inspection'}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {screen === 'list' ? <InspectionList /> : <LogForm onDone={() => setScreen('list')} />}
      </main>

      {/* Floating action button, thumb-reachable at the bottom of a 390px screen. */}
      {screen === 'list' && (
        <button
          type="button"
          onClick={() => setScreen('log')}
          disabled={referenceStatus !== 'ready'}
          className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-slate-900 text-2xl font-light text-white shadow-lg disabled:opacity-40"
          aria-label="Log an inspection"
        >
          ＋
        </button>
      )}
    </div>
  );
}

export default App;
