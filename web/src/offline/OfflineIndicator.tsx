import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  selectDeadLetter,
  selectIsOnline,
  selectPendingCount,
  selectSyncStatus,
} from './selectors';
import { deadLetterDiscarded, syncRequested } from './slice';

function changeCount(count: number) {
  return `${count} change${count === 1 ? '' : 's'}`;
}

/**
 * Three very different messages, deliberately separated.
 *
 * "Queued" is reassurance — the work is safe and will sync. "Couldn't sync" is a state the
 * user can act on. "Couldn't be saved" is a failure they have to know about: silently
 * dropping a rejected change would leave someone believing an inspection was logged when it
 * never was, which is the worst outcome in the app.
 */
export function OfflineIndicator() {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(selectIsOnline);
  const pendingCount = useAppSelector(selectPendingCount);
  const syncStatus = useAppSelector(selectSyncStatus);
  const deadLetter = useAppSelector(selectDeadLetter);

  if (deadLetter.length > 0) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm"
      >
        <p className="flex-1 wrap-break-word text-red-800">
          <span className="font-medium">{changeCount(deadLetter.length)} couldn’t be saved</span> —
          the server rejected {deadLetter.length === 1 ? 'it' : 'them'}, so retrying won’t help.
        </p>
        <button
          type="button"
          onClick={() => deadLetter.forEach((op) => dispatch(deadLetterDiscarded(op.opId)))}
          className="min-h-11 shrink-0 rounded-lg border border-red-300 px-3 font-medium text-red-800"
        >
          Discard
        </button>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="font-medium">Offline</span>
        {pendingCount > 0
          ? ` — ${changeCount(pendingCount)} queued, they’ll sync when you reconnect.`
          : ' — you can still log and resolve inspections.'}
      </div>
    );
  }

  if (pendingCount === 0) {
    return null;
  }

  // Online with work still queued. `failed` means the retry budget is spent, so the button
  // is the way back — it's a real control, not a hint buried in a status strip.
  const hasGivenUp = syncStatus === 'failed';

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${
        hasGivenUp ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'
      }`}
    >
      <p className={`flex-1 ${hasGivenUp ? 'text-amber-900' : 'text-blue-900'}`}>
        <span className="font-medium">
          {hasGivenUp ? 'Couldn’t sync' : 'Syncing'}
        </span>{' '}
        — {changeCount(pendingCount)} pending.
      </p>
      <button
        type="button"
        onClick={() => dispatch(syncRequested())}
        className={`min-h-11 shrink-0 rounded-lg border px-3 font-medium ${
          hasGivenUp
            ? 'border-amber-300 text-amber-900'
            : 'border-blue-300 text-blue-900'
        }`}
      >
        Sync now
      </button>
    </div>
  );
}
