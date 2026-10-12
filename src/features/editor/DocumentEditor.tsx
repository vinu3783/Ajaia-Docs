import { useCallback, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EditorContent, useEditor } from '@tiptap/react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { toUserMessage } from '../../lib/errors'
import { TITLE_MAX_LENGTH, type DocumentPatch, type DocumentRecord, type DocumentSummary } from '../../types/documents'
import { deleteDocument, updateDocument } from '../documents/documentsApi'
import { ShareDialog } from '../sharing/ShareDialog'
import { ROLE_LABELS, capabilitiesFor } from '../sharing/permissions'
import { editorExtensions } from './extensions'
import { SaveStatusIndicator } from './SaveStatusIndicator'
import { Toolbar } from './Toolbar'
import { useAutosave } from './useAutosave'

interface DocumentEditorProps {
  client: SupabaseClient
  doc: DocumentRecord
  onChanged: (id: string, changes: Partial<DocumentSummary>) => void
  onDeleted: (id: string) => void
}

export function DocumentEditor({ client, doc, onChanged, onDeleted }: DocumentEditorProps) {
  const caps = capabilitiesFor(doc.role)
  const [title, setTitle] = useState(doc.title)
  const [savedTitle, setSavedTitle] = useState(doc.title)
  const [contentError, setContentError] = useState(false)
  const [dialog, setDialog] = useState<'share' | 'delete' | null>(null)
  const canEdit = caps.canEdit && !contentError

  // Bound to this document's id for the lifetime of this component.
  const save = useCallback(
    async (patch: DocumentPatch) => {
      const updatedAt = await updateDocument(client, doc.id, patch)
      onChanged(doc.id, { updatedAt, ...(patch.title !== undefined && { title: patch.title }) })
      if (patch.title !== undefined) setSavedTitle(patch.title)
    },
    [client, doc.id, onChanged],
  )
  const autosave = useAutosave(save)

  const editor = useEditor({
    extensions: editorExtensions,
    content: doc.content,
    editable: caps.canEdit,
    enableContentCheck: true,
    onContentError: ({ editor: e }) => {
      // Never autosave over stored content we failed to parse.
      setContentError(true)
      e.setEditable(false)
    },
    onUpdate: ({ editor: e }) => autosave.update({ content: e.getJSON() }),
    editorProps: {
      attributes: {
        class: 'doc-content',
        'aria-label': `Document content${caps.canEdit ? '' : ' (read only)'}`,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
  })

  const titleTrimmed = title.trim()
  const titleInvalid = titleTrimmed.length === 0

  function handleTitleChange(next: string) {
    setTitle(next)
    if (next.trim()) autosave.update({ title: next.trim() })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor="doc-title" className="sr-only">
              Document title
            </label>
            <input
              id="doc-title"
              value={title}
              maxLength={TITLE_MAX_LENGTH}
              readOnly={!canEdit}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => titleInvalid && setTitle(savedTitle)}
              aria-invalid={titleInvalid}
              aria-describedby={titleInvalid ? 'doc-title-error' : undefined}
              className="w-full truncate rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none read-only:hover:border-transparent aria-invalid:border-red-400"
            />
            {titleInvalid && (
              <p id="doc-title-error" className="px-2 text-xs text-red-700">
                Title can't be empty — the previous title is kept.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {caps.canEdit ? (
              <SaveStatusIndicator status={autosave.status} onRetry={() => void autosave.flush()} />
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">View only</span>
            )}
            {doc.role !== 'owner' && (
              <span className="hidden text-xs text-slate-500 md:inline" title={doc.ownerEmail}>
                {ROLE_LABELS[doc.role]} · shared by {doc.ownerEmail ?? 'another user'}
              </span>
            )}
            {caps.canShare && (
              <button type="button" className="btn-primary" onClick={() => setDialog('share')}>
                Share
              </button>
            )}
            {caps.canDelete && (
              <button
                type="button"
                className="btn-ghost text-slate-600"
                aria-label="Delete document"
                title="Delete document"
                onClick={() => setDialog('delete')}
              >
                <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {autosave.status === 'error' && (
          <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800 sm:px-6">
            Your latest changes haven't been saved: {toUserMessage(autosave.error)} Keep this tab open and retry.
          </p>
        )}
        {contentError && (
          <p role="alert" className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
            Part of this document couldn't be displayed, so editing is disabled to avoid overwriting it.
          </p>
        )}

        {editor && caps.canEdit && (
          <div className="border-t border-slate-100">
            <Toolbar editor={editor} disabled={!canEdit} />
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100/70 px-2 py-4 sm:px-6 sm:py-8">
        <article className="mx-auto min-h-[60vh] w-full max-w-[816px] rounded-sm bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-16 sm:py-14">
          <EditorContent editor={editor} />
        </article>
      </div>

      {dialog === 'share' && <ShareDialog client={client} doc={doc} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <ConfirmDialog
          title="Delete document?"
          message={`“${savedTitle}” will be permanently deleted for you and everyone it is shared with.`}
          confirmLabel="Delete"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteDocument(client, doc.id)
            onDeleted(doc.id)
          }}
        />
      )}
    </div>
  )
}
