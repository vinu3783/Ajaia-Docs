import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { Logo } from '../../components/Logo'
import { toUserMessage } from '../../lib/errors'
import type { DocumentSummary } from '../../types/documents'
import { useAuth } from '../auth/AuthContext'
import { importFile } from '../import/importFile'
import { createDocument, listOwnedDocuments, listSharedDocuments } from './documentsApi'
import { DocumentView, EmptyState } from './DocumentView'
import { Sidebar } from './Sidebar'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readDocParam(): string | null {
  const id = new URLSearchParams(window.location.search).get('doc')
  return id && UUID_PATTERN.test(id) ? id : null
}

export function Workspace({ client, user }: { client: SupabaseClient; user: User }) {
  const { signOut } = useAuth()
  const [owned, setOwned] = useState<DocumentSummary[]>([])
  const [shared, setShared] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(readDocParam)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadLists = useCallback(async () => {
    try {
      const [mine, theirs] = await Promise.all([
        listOwnedDocuments(client, user.id),
        listSharedDocuments(client, user.id),
      ])
      setOwned(mine)
      setShared(theirs)
      setListError(null)
    } catch (err) {
      setListError(toUserMessage(err, 'Could not load your documents.'))
    } finally {
      setLoading(false)
    }
  }, [client, user.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void loadLists()
    // Pick up newly shared documents when the user comes back to the tab.
    const onFocus = () => void loadLists()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadLists])

  useEffect(() => {
    const onPop = () => setSelectedId(readDocParam())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
    setSidebarOpen(false)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('doc', id)
    else url.searchParams.delete('doc')
    window.history.pushState(null, '', url)
  }, [])

  async function handleCreate() {
    setCreating(true)
    setActionError(null)
    try {
      const doc = await createDocument(client)
      setOwned((docs) => [doc, ...docs])
      select(doc.id)
    } catch (err) {
      setActionError(toUserMessage(err, 'Could not create a document.'))
    } finally {
      setCreating(false)
    }
  }

  async function handleImport(file: File) {
    setImporting(true)
    setActionError(null)
    try {
      const imported = await importFile(file)
      const doc = await createDocument(client, imported)
      setOwned((docs) => [doc, ...docs])
      select(doc.id)
    } catch (err) {
      setActionError(toUserMessage(err, 'Could not import that file.'))
    } finally {
      setImporting(false)
    }
  }

  const handleChanged = useCallback((id: string, changes: Partial<DocumentSummary>) => {
    const apply = (docs: DocumentSummary[]) => {
      if (!docs.some((d) => d.id === id)) return docs
      return docs
        .map((d) => (d.id === id ? { ...d, ...changes } : d))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    setOwned(apply)
    setShared(apply)
  }, [])

  const handleDeleted = useCallback(
    (id: string) => {
      setOwned((docs) => docs.filter((d) => d.id !== id))
      select(null)
    },
    [select],
  )

  async function handleSignOut() {
    try {
      await signOut()
    } catch (err) {
      setActionError(toUserMessage(err, 'Could not sign out.'))
    }
  }

  const hasAnyDocs = owned.length + shared.length > 0

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-slate-900">
      {/* Sidebar: static on desktop, slide-over drawer on small screens. */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 md:hidden" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] border-r border-slate-200 bg-slate-50 transition-transform md:static md:z-auto md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          owned={owned}
          shared={shared}
          loading={loading}
          listError={listError}
          onRetryList={() => {
            setLoading(true)
            void loadLists()
          }}
          selectedId={selectedId}
          onSelect={select}
          query={query}
          onQueryChange={setQuery}
          onCreate={handleCreate}
          creating={creating}
          onImport={handleImport}
          importing={importing}
          actionError={actionError}
          onDismissError={() => setActionError(null)}
          userEmail={user.email ?? ''}
          onSignOut={handleSignOut}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2 md:hidden">
          <button
            type="button"
            className="btn-ghost px-2"
            aria-label="Open document list"
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Logo />
        </div>

        {selectedId ? (
          <DocumentView
            key={selectedId}
            client={client}
            documentId={selectedId}
            userId={user.id}
            onChanged={handleChanged}
            onDeleted={handleDeleted}
          />
        ) : (
          <EmptyState
            title={hasAnyDocs || loading ? 'Select a document' : 'Create your first document'}
            body={
              hasAnyDocs || loading
                ? 'Choose a document from the list, start a new one, or upload a .txt or .md file.'
                : 'Start a blank document or upload a .txt or .md file. You can share documents with other registered users.'
            }
          >
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn-primary" onClick={handleCreate} disabled={creating}>
                New document
              </button>
              <button type="button" className="btn-secondary md:hidden" onClick={() => setSidebarOpen(true)}>
                Browse documents
              </button>
            </div>
          </EmptyState>
        )}
      </main>
    </div>
  )
}
