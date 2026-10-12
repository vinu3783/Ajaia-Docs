import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '../auth/AuthContext'
import { EMPTY_DOC } from '../editor/content'
import type { DocumentRecord, DocumentSummary } from '../../types/documents'
import * as api from './documentsApi'
import { Workspace } from './Workspace'

// Component tests: the API module is mocked, so these verify UI behaviour only.
vi.mock('./documentsApi')
const mocked = vi.mocked(api)

const user = { id: 'u1', email: 'alice@example.com' } as User
const client = {} as SupabaseClient
const auth: AuthState = { session: null, user, loading: false, signOut: vi.fn() }

const summary = (over: Partial<DocumentSummary> = {}): DocumentSummary => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Untitled document',
  ownerId: 'u1',
  updatedAt: new Date().toISOString(),
  role: 'owner',
  ...over,
})

function renderWorkspace() {
  return render(
    <AuthContext.Provider value={auth}>
      <Workspace client={client} user={user} />
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  mocked.listOwnedDocuments.mockResolvedValue([])
  mocked.listSharedDocuments.mockResolvedValue([])
})

describe('Workspace', () => {
  it('lets a user create a document and opens it in the editor', async () => {
    const created = summary()
    mocked.createDocument.mockResolvedValue(created)
    mocked.getDocument.mockResolvedValue({ ...created, content: EMPTY_DOC } satisfies DocumentRecord)

    renderWorkspace()
    expect(await screen.findByText('No documents yet.')).toBeInTheDocument()

    await userEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /new document/i }))

    expect(mocked.createDocument).toHaveBeenCalledWith(client)
    const nav = screen.getByRole('navigation', { name: 'Documents' })
    expect(await within(nav).findByText('Untitled document')).toBeInTheDocument()
    expect(await screen.findByLabelText('Document title')).toHaveValue('Untitled document')
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument()
    expect(window.location.search).toBe(`?doc=${created.id}`)
  })

  it('shows owned and shared documents in separate sections and filters them', async () => {
    mocked.listOwnedDocuments.mockResolvedValue([summary({ id: 'a', title: 'Budget' })])
    mocked.listSharedDocuments.mockResolvedValue([
      summary({ id: 'b', title: 'Team plan', role: 'viewer', ownerId: 'u2', ownerEmail: 'bob@example.com' }),
    ])
    renderWorkspace()

    const mine = await screen.findByRole('region', { name: /my documents/i })
    const shared = screen.getByRole('region', { name: /shared with me/i })
    expect(within(mine).getByText('Budget')).toBeInTheDocument()
    expect(within(shared).getByText('Team plan')).toBeInTheDocument()
    expect(within(shared).getByText(/Can view · bob@example.com/)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Search documents'), 'budg')
    expect(within(mine).getByText('Budget')).toBeInTheDocument()
    expect(within(shared).getByText('No matches.')).toBeInTheDocument()
  })

  it('rejects an unsupported upload with a clear message and creates nothing', async () => {
    renderWorkspace()
    await screen.findByText('No documents yet.')
    const input = screen.getByTestId('file-input')
    await userEvent.upload(input, new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' }), { applyAccept: false })

    expect(await screen.findByRole('alert')).toHaveTextContent(/“scan.pdf” is not supported/)
    expect(mocked.createDocument).not.toHaveBeenCalled()
  })

  it('imports a Markdown file as a new document titled after the file', async () => {
    const created = summary({ title: 'Roadmap' })
    mocked.createDocument.mockResolvedValue(created)
    mocked.getDocument.mockResolvedValue({ ...created, content: EMPTY_DOC })
    renderWorkspace()
    await screen.findByText('No documents yet.')

    await userEvent.upload(screen.getByTestId('file-input'), new File(['# Q4\n- ship'], 'Roadmap.md', { type: '' }))

    await waitFor(() => expect(mocked.createDocument).toHaveBeenCalledTimes(1))
    const [, input] = mocked.createDocument.mock.calls[0]
    expect(input?.title).toBe('Roadmap')
    expect(input?.content?.content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 1 } })
  })

  it('shows a not-available state for documents the user cannot access', async () => {
    window.history.replaceState(null, '', '/?doc=22222222-2222-4222-8222-222222222222')
    mocked.getDocument.mockResolvedValue(null)
    renderWorkspace()
    expect(await screen.findByText('Document not available')).toBeInTheDocument()
  })
})
