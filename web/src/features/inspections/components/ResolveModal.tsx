import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { selectResolveError, selectResolveStatus } from '../selectors';
import { resolveFormReset, resolveRequested } from '../slice';

export function ResolveModal({ id, onClose }: { id: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectResolveStatus);
  const error = useAppSelector(selectResolveError);
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dispatch(resolveFormReset());
  }, [dispatch]);

  // Close once the submit this modal started has succeeded.
  useEffect(() => {
    if (submitted && status === 'idle') {
      onClose();
    }
  }, [submitted, status, onClose]);

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
    <div className="absolute inset-0 z-10 flex items-end bg-slate-900/40">
      <form
        onSubmit={handleSubmit}
        className="w-full rounded-t-2xl bg-white p-4 shadow-xl"
        // Sheet from the bottom: the controls stay in thumb reach on a 390px screen.
      >
        <h2 className="text-lg font-semibold text-slate-900">Resolve inspection</h2>
        <p className="mt-1 text-sm text-slate-500">
          A resolution note is required — it becomes the record of what was done.
        </p>

        <label htmlFor="resolutionNote" className="mt-4 block text-sm font-medium text-slate-700">
          Resolution note
        </label>
        <textarea
          id="resolutionNote"
          value={resolutionNote}
          onChange={(event) => setResolutionNote(event.target.value)}
          rows={4}
          autoFocus
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
          placeholder="What was done to fix it?"
        />

        {status === 'failed' && error && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-3 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {isSubmitting ? 'Saving…' : 'Resolve'}
          </button>
        </div>
      </form>
    </div>
  );
}
