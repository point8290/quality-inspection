import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { today } from '../../../lib/formatDate';
import { BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, CONTROL_CLASS } from '../../../lib/styles';
import { selectCreateError, selectCreateStatus } from '../selectors';
import { createFormReset, createRequested } from '../slice';

export function LogForm({ onDone }: { onDone: () => void }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectCreateStatus);
  const error = useAppSelector(selectCreateError);
  const { defectTypes, severities } = useAppSelector((state) => state.reference);

  const [inspectionDate, setInspectionDate] = useState(today());
  const [machineId, setMachineId] = useState('');
  const [defectTypeCode, setDefectTypeCode] = useState('');
  const [severityCode, setSeverityCode] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitted, setSubmitted] = useState(false);

  /**
   * One id for this inspection, not one per attempt — so a double tap or a retry carries the
   * same id and the server's idempotent create collapses it into a single row. (This is the
   * synchronizer-token pattern: the token is issued when the form is rendered, not when it
   * is submitted.)
   *
   * Relies on the form unmounting between inspections, which App does by rendering it
   * conditionally. If it ever stays mounted, regenerate this after a successful submit.
   */
  const [draftId] = useState(() => crypto.randomUUID());

  // Close once the submit that this form started has succeeded.
  useEffect(() => {
    if (submitted && status === 'idle') {
      onDone();
    }
  }, [submitted, status, onDone]);

  // Clear any stale validation errors when the form opens.
  useEffect(() => {
    dispatch(createFormReset());
  }, [dispatch]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    dispatch(
      createRequested({
        id: draftId,
        inspectionDate,
        machineId: machineId.trim(),
        defectTypeCode,
        severityCode,
        remarks: remarks.trim() === '' ? undefined : remarks.trim(),
      }),
    );
  }

  const isSubmitting = status === 'submitting';
  const canSubmit =
    machineId.trim() !== '' && defectTypeCode !== '' && severityCode !== '' && !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div>
        <label htmlFor="inspectionDate" className="block text-sm font-medium text-slate-700">
          Inspection date
        </label>
        <input
          id="inspectionDate"
          type="date"
          value={inspectionDate}
          onChange={(event) => setInspectionDate(event.target.value)}
          className={CONTROL_CLASS}
          required
        />
      </div>

      <div>
        <label htmlFor="machineId" className="block text-sm font-medium text-slate-700">
          Machine / line
        </label>
        <input
          id="machineId"
          value={machineId}
          onChange={(event) => setMachineId(event.target.value)}
          placeholder="LOOM-04"
          className={CONTROL_CLASS}
          required
        />
      </div>

      <div>
        <label htmlFor="defectTypeCode" className="block text-sm font-medium text-slate-700">
          Defect type
        </label>
        <select
          id="defectTypeCode"
          value={defectTypeCode}
          onChange={(event) => setDefectTypeCode(event.target.value)}
          className={CONTROL_CLASS}
          required
        >
          <option value="">Select…</option>
          {defectTypes.map((defectType) => (
            <option key={defectType.code} value={defectType.code}>
              {defectType.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="severityCode" className="block text-sm font-medium text-slate-700">
          Severity
        </label>
        <select
          id="severityCode"
          value={severityCode}
          onChange={(event) => setSeverityCode(event.target.value)}
          className={CONTROL_CLASS}
          required
        >
          <option value="">Select…</option>
          {severities.map((severity) => (
            <option key={severity.code} value={severity.code}>
              {severity.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="remarks" className="block text-sm font-medium text-slate-700">
          Remarks <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          rows={3}
          className={CONTROL_CLASS}
        />
      </div>

      {status === 'failed' && error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm wrap-break-word text-red-800">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onDone}
          className={`flex-1 ${BUTTON_SECONDARY_CLASS}`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className={`flex-1 ${BUTTON_PRIMARY_CLASS}`}
        >
          {isSubmitting ? 'Saving…' : 'Log inspection'}
        </button>
      </div>
    </form>
  );
}
