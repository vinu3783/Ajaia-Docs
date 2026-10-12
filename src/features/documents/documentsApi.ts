import type { SupabaseClient } from '@supabase/supabase-js'
import type { JSONContent } from '@tiptap/core'
import { AccessLostError } from '../../lib/errors'
import { EMPTY_DOC, isDocJSON } from '../editor/content'
import {
  DEFAULT_TITLE,
  type AccessRole,
  type DocumentPatch,
  type DocumentRecord,
  type DocumentSummary,
  type Permission,
} from '../../types/documents'

interface DocumentRow {
  id: string
  title: string
  owner_id: string
  updated_at: string
  content?: unknown
}

interface SharedRow {
  permission: Permission
  document: (DocumentRow & { owner: { email: string } | null }) | null
}

const SUMMARY_COLUMNS = 'id, title, owner_id, updated_at'

function toSummary(row: DocumentRow, role: AccessRole, ownerEmail?: string): DocumentSummary {
  return { id: row.id, title: row.title, ownerId: row.owner_id, updatedAt: row.updated_at, role, ownerEmail }
}

/**
 * Document persistence. Every function takes the Supabase client explicitly so
 * it can be unit-tested with a fake. Authorization is NOT decided here — RLS is
 * the source of truth; these functions only surface what the database allows.
 */
export async function listOwnedDocuments(db: SupabaseClient, userId: string): Promise<DocumentSummary[]> {
  const { data, error } = await db
    .from('documents')
    .select(SUMMARY_COLUMNS)
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as DocumentRow[]).map((row) => toSummary(row, 'owner'))
}

export async function listSharedDocuments(db: SupabaseClient, userId: string): Promise<DocumentSummary[]> {
  const { data, error } = await db
    .from('document_shares')
    .select(`permission, document:documents (${SUMMARY_COLUMNS}, owner:profiles (email))`)
    .eq('shared_with_user_id', userId)
  if (error) throw error
  return (data as unknown as SharedRow[])
    .filter((row) => row.document)
    .map((row) => toSummary(row.document!, row.permission, row.document!.owner?.email))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Returns null when the document doesn't exist OR the user may not see it (indistinguishable by design). */
export async function getDocument(db: SupabaseClient, id: string, userId: string): Promise<DocumentRecord | null> {
  const { data, error } = await db.from('documents').select(`${SUMMARY_COLUMNS}, content`).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as DocumentRow

  let role: AccessRole = 'owner'
  let ownerEmail: string | undefined
  if (row.owner_id !== userId) {
    const share = await db
      .from('document_shares')
      .select('permission, document:documents (owner:profiles (email))')
      .eq('document_id', id)
      .eq('shared_with_user_id', userId)
      .maybeSingle()
    if (share.error) throw share.error
    if (!share.data) return null
    const shareRow = share.data as unknown as { permission: Permission; document: { owner: { email: string } | null } | null }
    role = shareRow.permission
    ownerEmail = shareRow.document?.owner?.email
  }

  const content: JSONContent = isDocJSON(row.content) ? row.content : EMPTY_DOC
  return { ...toSummary(row, role, ownerEmail), content }
}

export async function createDocument(
  db: SupabaseClient,
  input: { title?: string; content?: JSONContent } = {},
): Promise<DocumentSummary> {
  // owner_id is intentionally omitted: the database sets it from auth.uid()
  // and the client has no privilege to supply it.
  const { data, error } = await db
    .from('documents')
    .insert({ title: input.title?.trim() || DEFAULT_TITLE, content: input.content ?? EMPTY_DOC })
    .select(SUMMARY_COLUMNS)
    .single()
  if (error) throw error
  return toSummary(data as DocumentRow, 'owner')
}

/** Resolves only when the database confirms the write; returns the new updated_at. */
export async function updateDocument(db: SupabaseClient, id: string, patch: DocumentPatch): Promise<string> {
  const { data, error } = await db.from('documents').update(patch).eq('id', id).select('updated_at')
  if (error) throw error
  // RLS turns unauthorized updates into "0 rows updated" rather than an error.
  if (!data || data.length !== 1) throw new AccessLostError()
  return (data[0] as { updated_at: string }).updated_at
}

export async function deleteDocument(db: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await db.from('documents').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length !== 1) throw new AccessLostError('Only the owner can delete this document.')
}
