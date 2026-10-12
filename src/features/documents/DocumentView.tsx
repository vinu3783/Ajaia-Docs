import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Spinner } from '../../components/Spinner'
import { toUserMessage } from '../../lib/errors'
import type { DocumentRecord, DocumentSummary } from '../../types/documents'
import { DocumentEditor } from '../editor/DocumentEditor'
import { getDocument } from './documentsApi'

interface DocumentViewProps {
  client: SupabaseClient
  documentId: string
  userId: string
  onChanged: (id: string, changes: Partial<DocumentSummary>) => void
  onDeleted: (id: string) => void
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; doc: DocumentRecord }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }

/**
 * Loads a single document. Rendered with key={documentId}, so switching
 * documents remounts everything below (editor, autosave) with fresh state.
 */
export function DocumentView({ client, documentId, userId, onChanged, onDeleted }: DocumentViewProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getDocument(client, documentId, userId).then(
      (doc) => !cancelled && setState(doc ? { kind: 'ready', doc } : { kind: 'missing' }),
      (err) => !cancelled && setState({ kind: 'error', message: toUserMessage(err, 'Could not load this document.') }),
    )
    return () => {
      cancelled = true // ignore late responses after switching documents
    }
  }, [client, documentId, userId, attempt])

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Spinner label="Loading document…" />
      </div>
    )
  }
  if (state.kind === 'missing') {
    return (
      <EmptyState
        title="Document not available"
        body="It may have been deleted, or it hasn't been shared with you."
      />
    )
  }
  if (state.kind === 'error') {
    return (
      <EmptyState title="Couldn't open document" body={state.message}>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => {
            setState({ kind: 'loading' })
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </EmptyState>
    )
  }
  return <DocumentEditor client={client} doc={state.doc} onChanged={onChanged} onDeleted={onDeleted} />
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
          <path d="M14 3v5h5" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-600">{body}</p>
      {children}
    </div>
  )
}
