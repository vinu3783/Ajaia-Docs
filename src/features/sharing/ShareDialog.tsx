import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Modal } from '../../components/Modal'
import { Spinner } from '../../components/Spinner'
import { toUserMessage } from '../../lib/errors'
import type { DocumentShare, DocumentSummary, Permission } from '../../types/documents'
import { EMAIL_PATTERN, listShares, removeShare, shareDocument, updateSharePermission } from './sharingApi'

interface ShareDialogProps {
  client: SupabaseClient
  doc: DocumentSummary
  onClose: () => void
}

export function ShareDialog({ client, doc, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<DocumentShare[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<Permission>('viewer')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyShareId, setBusyShareId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setShares(await listShares(client, doc.id))
      setLoadError(null)
    } catch (err) {
      setLoadError(toUserMessage(err, 'Could not load who has access.'))
    }
  }, [client, doc.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void refresh()
  }, [refresh])

  async function handleShare(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setNotice(null)
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) return setFormError('Enter a valid email address.')
    if (shares?.some((s) => s.email.toLowerCase() === trimmed.toLowerCase())) {
      return setFormError('This document is already shared with that user. Change their access below.')
    }
    setSubmitting(true)
    try {
      await shareDocument(client, doc.id, trimmed, permission)
      setEmail('')
      setNotice(`Shared with ${trimmed}.`)
      await refresh()
    } catch (err) {
      setFormError(toUserMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function withShare(shareId: string, action: () => Promise<void>) {
    setBusyShareId(shareId)
    setFormError(null)
    setNotice(null)
    try {
      await action()
      await refresh()
    } catch (err) {
      setFormError(toUserMessage(err))
    } finally {
      setBusyShareId(null)
    }
  }

  return (
    <Modal
      title={`Share “${doc.title}”`}
      description="People must already have an Ajaia Docs account. Viewers can read; editors can also edit the title and content. Only you can share or delete."
      onClose={onClose}
    >
      <form onSubmit={handleShare} noValidate className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="share-email" className="sr-only">
          Email address
        </label>
        <input
          id="share-email"
          type="email"
          placeholder="name@example.com"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input min-w-0 flex-1"
        />
        <label htmlFor="share-permission" className="sr-only">
          Permission
        </label>
        <select
          id="share-permission"
          value={permission}
          onChange={(e) => setPermission(e.target.value as Permission)}
          className="input sm:w-28"
        >
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting && <Spinner className="size-4" />}
          Share
        </button>
      </form>

      {formError && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <h3 className="mt-6 text-sm font-medium text-slate-900">People with access</h3>
      <div className="mt-2">
        {loadError ? (
          <p role="alert" className="text-sm text-red-700">
            {loadError}{' '}
            <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => void refresh()}>
              Retry
            </button>
          </p>
        ) : shares === null ? (
          <Spinner className="size-4" label="Loading…" />
        ) : (
          <ul className="divide-y divide-slate-100">
            <li className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">You</span>
              <span className="text-slate-500">Owner</span>
            </li>
            {shares.map((share) => (
              <li key={share.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-700" title={share.email}>
                  {share.email}
                </span>
                <label htmlFor={`perm-${share.id}`} className="sr-only">
                  Permission for {share.email}
                </label>
                <select
                  id={`perm-${share.id}`}
                  value={share.permission}
                  disabled={busyShareId === share.id}
                  onChange={(e) =>
                    void withShare(share.id, () => updateSharePermission(client, share.id, e.target.value as Permission))
                  }
                  className="input w-auto py-1"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  type="button"
                  className="btn-ghost px-2 py-1 text-red-700"
                  disabled={busyShareId === share.id}
                  aria-label={`Remove access for ${share.email}`}
                  onClick={() => void withShare(share.id, () => removeShare(client, share.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {shares?.length === 0 && <p className="mt-1 text-sm text-slate-500">Not shared with anyone yet.</p>}
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
