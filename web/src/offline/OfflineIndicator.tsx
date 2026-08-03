import { useAppDispatch, useAppSelector } from '../app/hooks';
import { selectDeadLetter, selectIsOnline, selectPendingCount } from './selectors';
import { deadLetterDiscarded, syncRequested } from './slice';

/**
 * Two very different messages, deliberately separated.
 *
 * "Queued" is reassurance — the work is safe and will sync. "Couldn't be saved" is a failure
 * the user has to know about: silently dropping a rejected change would leave someone
 * believing an inspection was logged when it never was. That's the worst outcome in the app,
 * so it gets a persistent, visible banner.
 */
export function OfflineIndicator() {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(selectIsOnline);
  const pendingCount = useAppSelector(selectPendingCount);
  const deadLetter = useAppSelector(selectDeadLetter);

  if (deadLetter.length > 0) {
    return (
      <div role="alert" className="flex items-center gap-3 bg-red-50 px-4 py-2 text-sm">
        <p className="flex-1 wrap-break-word text-red-800">
          <span className="font-medium">
            {deadLetter.length === 1
              ? '1 change couldn’t be saved'
              : `${deadLetter.length} changes couldn’t be saved`}
          </span>{' '}
          — the server rejected it, so retrying won’t help.
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
      <div className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <span className="font-medium">Offline</span>
        {pendingCount > 0
          ? ` — ${pendingCount} change${pendingCount === 1 ? '' : 's'} queued, they’ll sync when you reconnect.`
          : ' — you can still log and resolve inspections.'}
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={() => dispatch(syncRequested())}
        className="w-full bg-blue-50 px-4 py-2 text-left text-sm text-blue-900"
      >
        <span className="font-medium">Syncing</span> — {pendingCount} change
        {pendingCount === 1 ? '' : 's'} pending. Tap to retry now.
      </button>
    );
  }

  return null;
}
