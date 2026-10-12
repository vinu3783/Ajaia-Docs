import type { SaveStatus } from './autosave'

const LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Not saved',
}

const DOT: Record<SaveStatus, string> = {
  saved: 'bg-emerald-500',
  unsaved: 'bg-amber-500',
  saving: 'bg-blue-500 animate-pulse',
  error: 'bg-red-500',
}

export function SaveStatusIndicator({ status, onRetry }: { status: SaveStatus; onRetry?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-slate-600">
      <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5">
        <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden="true" />
        <span className={status === 'error' ? 'font-medium text-red-700' : undefined}>{LABELS[status]}</span>
      </span>
      {status === 'error' && onRetry && (
        <button type="button" onClick={onRetry} className="font-medium text-blue-700 hover:underline">
          Retry
        </button>
      )}
    </span>
  )
}
