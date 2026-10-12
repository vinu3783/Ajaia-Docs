import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRecord } from '../../types/documents'
import * as api from '../documents/documentsApi'
import { DocumentEditor } from './DocumentEditor'

vi.mock('../documents/documentsApi')
const mocked = vi.mocked(api)
const client = {} as SupabaseClient

const doc = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'd1',
  title: 'Spec',
  ownerId: 'u1',
  updatedAt: '2026-10-12T00:00:00Z',
  role: 'owner',
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
  ...over,
})

function renderEditor(d: DocumentRecord) {
  return render(<DocumentEditor client={client} doc={d} onChanged={vi.fn()} onDeleted={vi.fn()} onCopied={onCopied} />)
}

const onCopied = vi.fn()
beforeEach(() => vi.resetAllMocks())

describe('DocumentEditor', () => {
  it('owner sees toolbar, share and delete controls', async () => {
    renderEditor(doc())
    expect(await screen.findByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete document' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('viewer gets a read-only document with no editing, sharing or delete controls', async () => {
    renderEditor(doc({ role: 'viewer', ownerId: 'u2', ownerEmail: 'alice@example.com' }))
    expect(await screen.findByText('View only')).toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete document' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Document title')).toHaveAttribute('readonly')
    expect(screen.getByRole('textbox', { name: /document content/i })).toHaveAttribute('contenteditable', 'false')
  })

  it('editor can edit but cannot share or delete', async () => {
    renderEditor(doc({ role: 'editor', ownerId: 'u2' }))
    expect(await screen.findByRole('toolbar')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /document content/i })).toHaveAttribute('contenteditable', 'true')
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete document' })).not.toBeInTheDocument()
  })

  it('autosaves a renamed title and only reports Saved after the database confirms', async () => {
    let confirm!: (v: string) => void
    mocked.updateDocument.mockImplementation(() => new Promise<string>((res) => (confirm = res)))
    renderEditor(doc())

    const title = screen.getByLabelText('Document title')
    await userEvent.clear(title)
    expect(screen.getByText(/Title can't be empty/)).toBeInTheDocument()
    await userEvent.type(title, 'Launch plan')
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes')

    await act(() => new Promise((r) => setTimeout(r, 900))) // debounce
    expect(mocked.updateDocument).toHaveBeenCalledWith(client, 'd1', { title: 'Launch plan' })
    expect(screen.getByRole('status')).toHaveTextContent('Saving…')

    await act(async () => confirm('2026-10-12T00:00:01Z'))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
  })

  it('shows a save error with retry when the database rejects the write', async () => {
    mocked.updateDocument.mockRejectedValue(new Error('Network error — check your connection and try again.'))
    renderEditor(doc())
    await userEvent.type(screen.getByLabelText('Document title'), '!')
    await act(() => new Promise((r) => setTimeout(r, 900)))
    expect(screen.getByRole('status')).toHaveTextContent('Not saved')
    expect(screen.getByRole('alert')).toHaveTextContent(/haven't been saved/)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('toolbar reflects and toggles formatting', async () => {
    renderEditor(doc())
    const bold = await screen.findByRole('button', { name: 'Bold' })
    expect(bold).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(bold) // toggles the stored mark at the cursor
    expect(bold).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Heading 1' }))
    expect(screen.getByRole('button', { name: 'Heading 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Normal text' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('File menu: "Make a copy" saves the current content as a new document the user owns', async () => {
    const copy = { id: 'd2', title: 'Copy of Spec', ownerId: 'u2', updatedAt: 't', role: 'owner' as const }
    mocked.createDocument.mockResolvedValue(copy)
    renderEditor(doc({ role: 'viewer', ownerId: 'u1' })) // viewers can copy too
    await userEvent.click(screen.getByRole('button', { name: 'File' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /make a copy/i }))
    expect(mocked.createDocument).toHaveBeenCalledWith(client, {
      title: 'Copy of Spec',
      content: expect.objectContaining({ type: 'doc' }),
    })
    expect(onCopied).toHaveBeenCalledWith(copy)
  })

  it('File menu: print and Markdown download', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const blobs: Blob[] = []
    URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), 'blob:x'))
    URL.revokeObjectURL = vi.fn()
    const clicked: string[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download)
    })

    renderEditor(doc())
    await userEvent.click(screen.getByRole('button', { name: 'File' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /print/i }))
    expect(print).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'File' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /markdown/i }))
    expect(clicked).toEqual(['Spec.md'])
    expect(await blobs[0].text()).toBe('Hello world\n')
    print.mockRestore()
    click.mockRestore()
  })
})
