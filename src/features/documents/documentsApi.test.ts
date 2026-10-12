import { describe, expect, it } from 'vitest'
import { fakeSupabase } from '../../test/fakeSupabase'
import { AccessLostError } from '../../lib/errors'
import { EMPTY_DOC } from '../editor/content'
import { createDocument, updateDocument } from './documentsApi'
import { shareDocument } from '../sharing/sharingApi'

// Unit tests of the data-access layer with a fake client (no database).
// Database authorization itself is tested in supabase/tests/rls.test.ts.

describe('createDocument', () => {
  it('inserts only title and content — never owner_id', async () => {
    const row = { id: 'd1', title: 'Untitled document', owner_id: 'u1', updated_at: '2026-10-12T00:00:00Z' }
    const { client, calls } = fakeSupabase({ data: row, error: null })

    const doc = await createDocument(client)

    expect(calls[0]).toEqual(['from', 'documents'])
    expect(calls[1]).toEqual(['insert', { title: 'Untitled document', content: EMPTY_DOC }])
    expect(doc).toEqual({ id: 'd1', title: 'Untitled document', ownerId: 'u1', updatedAt: row.updated_at, role: 'owner', ownerEmail: undefined })
  })

  it('trims imported titles and surfaces database errors', async () => {
    const { client, calls } = fakeSupabase({ data: null, error: { message: 'boom' } })
    await expect(createDocument(client, { title: '  Notes  ' })).rejects.toEqual({ message: 'boom' })
    expect(calls[1][1]).toMatchObject({ title: 'Notes' })
  })
})

describe('updateDocument', () => {
  it('returns the confirmed updated_at', async () => {
    const { client } = fakeSupabase({ data: [{ updated_at: 't2' }], error: null })
    await expect(updateDocument(client, 'd1', { title: 'x' })).resolves.toBe('t2')
  })

  it('treats "0 rows updated" (how RLS rejects updates) as a failure, not a save', async () => {
    const { client } = fakeSupabase({ data: [], error: null })
    await expect(updateDocument(client, 'd1', { title: 'x' })).rejects.toBeInstanceOf(AccessLostError)
  })
})

describe('shareDocument', () => {
  it('calls the share_document RPC with a trimmed email', async () => {
    const { client, calls } = fakeSupabase({ data: {}, error: null })
    await shareDocument(client, 'd1', '  bob@example.com ', 'editor')
    expect(calls[0]).toEqual(['rpc', 'share_document', { p_document_id: 'd1', p_email: 'bob@example.com', p_permission: 'editor' }])
  })
})
