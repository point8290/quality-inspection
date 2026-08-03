import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CONTROL_CLASS } from '../../../lib/styles';
import { selectResolveError, selectResolveStatus } from '../selectors';
import { resolveFormReset, resolveRequested } from '../slice';

export function ResolveModal({ id, onClose }: { id: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectResolveStatus);
  const error = useAppSelector(selectResolveError);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    dispatch(resolveFormReset());
    noteRef.current?.focus();
  }, [dispatch]);

  // Close once the submit this modal started has succeeded.
  useEffect(() => {
    if (submitted && status === 'idle') {
      onClose();
    }
  }, [submitted, status, onClose]);

  /**
   * Escape closes, and Tab cycles inside the dialog. Without the trap, tabbing walks into
   * the list behind the overlay — reachable by keyboard but invisible under the scrim.
   */
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea',
    );
    if (!focusable || focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const isSubmitting = status === 'submitting';
  // The note is mandatory, so the button stays dead until there's something to send. The
  // server enforces the same rule — this is UX, not the guarantee.
  const canSubmit = resolutionNote.trim() !== '' && !isSubmitting;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    dispatch(resolveRequested({ id, resolutionNote: resolutionNote.trim() }));
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-title"
      onKeyDown={handleKeyDown}
      className="absolute inset-0 z-10 flex items-end bg-slate-900/40"
    >
      {/* Sheet from the bottom: the controls stay in thumb reach on a 390px screen. */}
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-t-2xl bg-white p-4 shadow-xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <h2 id="resolve-title" className="text-lg font-semibold text-slate-900">
          Resolve inspection
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          A resolution note is required — it becomes the record of what was done.
        </p>

        <label htmlFor="resolutionNote" className="mt-4 block text-sm font-medium text-slate-700">
          Resolution note
        </label>
        <textarea
          id="resolutionNote"
          ref={noteRef}
          value={resolutionNote}
          onChange={(event) => setResolutionNote(event.target.value)}
          rows={4}
          className={CONTROL_CLASS}
          placeholder="What was done to fix it?"
        />

        {status === 'failed' && error && (
          <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 ${BUTTON_SECONDARY_CLASS}`}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit} className={`flex-1 ${BUTTON_PRIMARY_CLASS}`}>
            {isSubmitting ? 'Saving…' : 'Resolve'}
          </button>
        </div>
      </form>
    </div>
  );
}
