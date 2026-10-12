import { useRef, type ChangeEvent } from 'react'
import { Logo } from '../../components/Logo'
import { Spinner } from '../../components/Spinner'
import type { DocumentSummary } from '../../types/documents'
import { ACCEPT_ATTRIBUTE, SUPPORTED_FORMATS_LABEL } from '../import/importFile'
import { ROLE_LABELS } from '../sharing/permissions'
import { filterDocuments } from './filterDocuments'

export interface SidebarProps {
  owned: DocumentSummary[]
  shared: DocumentSummary[]
  loading: boolean
  listError: string | null
  onRetryList: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  onQueryChange: (q: string) => void
  onCreate: () => void
  creating: boolean
  onImport: (file: File) => void
  importing: boolean
  actionError: string | null
  onDismissError: () => void
  userEmail: string
  onSignOut: () => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
function formatUpdated(iso: string): string {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString() ? timeFormat.format(d) : dateFormat.format(d)
}

function DocList({
  label,
  docs,
  total,
  selectedId,
  onSelect,
  emptyText,
}: {
  label: string
  docs: DocumentSummary[]
  total: number
  selectedId: string | null
  onSelect: (id: string) => void
  emptyText: string
}) {
  const headingId = `nav-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={headingId} className="mt-5">
      <h2 id={headingId} className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} <span className="font-normal text-slate-400">({total})</span>
      </h2>
      {docs.length === 0 ? (
        <p className="px-3 pt-2 text-sm text-slate-500">{total === 0 ? emptyText : 'No matches.'}</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5">
          {docs.map((doc) => {
            const selected = doc.id === selectedId
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(doc.id)}
                  aria-current={selected ? 'page' : undefined}
                  className={`w-full rounded-md px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-blue-600 ${
                    selected ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="block truncate text-sm font-medium">{doc.title}</span>
                  <span className="mt-0.5 flex gap-1.5 text-xs text-slate-500">
                    <span>{formatUpdated(doc.updatedAt)}</span>
                    {doc.role !== 'owner' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">
                          {ROLE_LABELS[doc.role]} · {doc.ownerEmail ?? 'shared'}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Sidebar(props: SidebarProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const owned = filterDocuments(props.owned, props.query)
  const shared = filterDocuments(props.shared, props.query)

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file after an error
    if (file) props.onImport(file)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <Logo />
      </div>

      <div className="space-y-2 px-3">
        <button type="button" className="btn-primary w-full" onClick={props.onCreate} disabled={props.creating}>
          {props.creating ? (
            <Spinner className="size-4" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
          New document
        </button>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => fileInput.current?.click()}
          disabled={props.importing}
          aria-describedby="upload-help"
        >
          {props.importing ? (
            <Spinner className="size-4" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
            </svg>
          )}
          Upload document
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          className="hidden"
          onChange={handleFile}
          data-testid="file-input"
          aria-label="Upload a .txt or .md file"
        />
        <p id="upload-help" className="px-1 text-xs text-slate-500">
          Imports {SUPPORTED_FORMATS_LABEL} as a new document.
        </p>
        {props.actionError && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="flex-1">{props.actionError}</span>
            <button type="button" onClick={props.onDismissError} aria-label="Dismiss error" className="text-red-500 hover:text-red-800">
              ×
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 px-3">
        <label htmlFor="doc-search" className="sr-only">
          Search documents
        </label>
        <input
          id="doc-search"
          type="search"
          placeholder="Search documents"
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          className="input"
        />
      </div>

      <nav aria-label="Documents" className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {props.loading ? (
          <div className="px-3 pt-6 text-slate-500">
            <Spinner className="size-4" label="Loading documents…" />
          </div>
        ) : props.listError ? (
          <div role="alert" className="mx-1 mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {props.listError}{' '}
            <button type="button" className="font-medium underline" onClick={props.onRetryList}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <DocList
              label="My Documents"
              docs={owned}
              total={props.owned.length}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              emptyText="No documents yet."
            />
            <DocList
              label="Shared with Me"
              docs={shared}
              total={props.shared.length}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              emptyText="Nothing has been shared with you yet."
            />
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold uppercase text-blue-800"
          aria-hidden="true"
        >
          {props.userEmail.charAt(0)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={props.userEmail}>
          {props.userEmail}
        </span>
        <button type="button" className="btn-ghost px-2 py-1 text-sm" onClick={props.onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
