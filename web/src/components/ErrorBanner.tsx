/**
 * Announced to assistive tech, because an error a screen reader never hears is an error the
 * user never gets. `role="alert"` implies aria-live="assertive".
 */
export function ErrorBanner({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 bg-red-50 px-4 py-3 text-sm">
      <div className="flex-1">
        <p className="font-medium wrap-break-word text-red-800">{message}</p>
        {detail && <p className="mt-0.5 wrap-break-word text-red-700">{detail}</p>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 shrink-0 rounded-lg border border-red-300 px-3 font-medium text-red-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}
