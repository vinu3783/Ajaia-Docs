import type { SupabaseClient } from '@supabase/supabase-js'
import { AccessLostError } from '../../lib/errors'
import type { DocumentShare, Permission } from '../../types/documents'

interface ShareRow {
  id: string
  shared_with_user_id: string
  permission: Permission
  created_at: string
  user: { email: string } | null
}

const SHARE_COLUMNS = 'id, shared_with_user_id, permission, created_at, user:profiles (email)'

function toShare(row: ShareRow): DocumentShare {
  return {
    id: row.id,
    userId: row.shared_with_user_id,
    email: row.user?.email ?? 'Unknown user',
    permission: row.permission,
    createdAt: row.created_at,
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function listShares(db: SupabaseClient, documentId: string): Promise<DocumentShare[]> {
  const { data, error } = await db
    .from('document_shares')
    .select(SHARE_COLUMNS)
    .eq('document_id', documentId)
    .order('created_at')
  if (error) throw error
  return (data as unknown as ShareRow[]).map(toShare)
}

/**
 * Shares via the share_document RPC, which resolves the email server-side
 * (auth users aren't readable by clients) and inserts under the caller's RLS.
 */
export async function shareDocument(
  db: SupabaseClient,
  documentId: string,
  email: string,
  permission: Permission,
): Promise<void> {
  const { error } = await db.rpc('share_document', {
    p_document_id: documentId,
    p_email: email.trim(),
    p_permission: permission,
  })
  if (error) throw error
}

export async function updateSharePermission(db: SupabaseClient, shareId: string, permission: Permission): Promise<void> {
  const { data, error } = await db.from('document_shares').update({ permission }).eq('id', shareId).select('id')
  if (error) throw error
  if (!data || data.length !== 1) throw new AccessLostError('Only the owner can change access.')
}

export async function removeShare(db: SupabaseClient, shareId: string): Promise<void> {
  const { data, error } = await db.from('document_shares').delete().eq('id', shareId).select('id')
  if (error) throw error
  if (!data || data.length !== 1) throw new AccessLostError('Only the owner can remove access.')
}
