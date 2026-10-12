// @vitest-environment node
/**
 * Database authorization tests.
 *
 * These run the real migration (supabase/migrations/*.sql) against real PostgreSQL
 * (PGlite = Postgres compiled to WASM) and execute queries as the `authenticated`
 * role with a per-request auth.uid(), exactly how PostgREST/Supabase evaluates RLS.
 * They do NOT talk to a hosted Supabase project; see supabase/tests/supabase-shim.sql
 * for the small part of Supabase that is emulated.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite, type Transaction } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const here = import.meta.dirname
const migrationsDir = join(here, '..', 'migrations')

const ALICE = '00000000-0000-4000-8000-00000000000a'
const BOB = '00000000-0000-4000-8000-00000000000b'
const CAROL = '00000000-0000-4000-8000-00000000000c'

let db: PGlite

/** Run `fn` inside a transaction as the given user (or as anon when null). */
async function as<T>(userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    await tx.exec(userId ? 'set local role authenticated' : 'set local role anon')
    return fn(tx)
  })
}

async function createDoc(owner: string, title = 'Plan'): Promise<string> {
  const { rows } = await as(owner, (tx) =>
    tx.query<{ id: string }>(`insert into public.documents (title) values ($1) returning id`, [title]),
  )
  return rows[0].id
}

async function visibleDocIds(user: string): Promise<string[]> {
  const { rows } = await as(user, (tx) => tx.query<{ id: string }>('select id from public.documents'))
  return rows.map((r) => r.id)
}

async function share(owner: string, docId: string, email: string, permission: 'viewer' | 'editor') {
  return as(owner, (tx) => tx.query(`select * from public.share_document($1, $2, $3)`, [docId, email, permission]))
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(join(here, 'supabase-shim.sql'), 'utf8'))
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && !f.startsWith('._')).sort()
  for (const file of files) await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  await db.query(
    `insert into auth.users (id, email) values ($1, 'alice@example.com'), ($2, 'bob@example.com'), ($3, 'carol@example.com')`,
    [ALICE, BOB, CAROL],
  )
}, 60_000)

describe('profiles trigger', () => {
  it('creates a profile for every new auth user', async () => {
    const { rows } = await db.query<{ email: string }>('select email from public.profiles order by email')
    expect(rows.map((r) => r.email)).toEqual(['alice@example.com', 'bob@example.com', 'carol@example.com'])
  })
})

describe('document ownership', () => {
  it('sets owner_id from auth.uid() and lets the owner read it back', async () => {
    const id = await createDoc(ALICE)
    const { rows } = await as(ALICE, (tx) =>
      tx.query<{ owner_id: string; title: string }>('select owner_id, title from public.documents where id = $1', [id]),
    )
    expect(rows).toEqual([{ owner_id: ALICE, title: 'Plan' }])
  })

  it('preserves rich-text JSON exactly through save and load', async () => {
    const id = await createDoc(ALICE)
    const content = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }, { type: 'underline' }] }] },
      ],
    }
    await as(ALICE, (tx) => tx.query('update public.documents set content = $1 where id = $2', [content, id]))
    const { rows } = await as(ALICE, (tx) =>
      tx.query<{ content: unknown }>('select content from public.documents where id = $1', [id]),
    )
    expect(rows[0].content).toEqual(content)
  })

  it('rejects a client-supplied owner_id (no column privilege)', async () => {
    await expect(
      as(ALICE, (tx) => tx.query(`insert into public.documents (owner_id, title) values ($1, 'x')`, [BOB])),
    ).rejects.toThrow(/permission denied/)
  })

  it('rejects changing owner_id after creation', async () => {
    const id = await createDoc(ALICE)
    await expect(
      as(ALICE, (tx) => tx.query('update public.documents set owner_id = $1 where id = $2', [BOB, id])),
    ).rejects.toThrow(/permission denied/)
  })

  it('rejects blank titles', async () => {
    await expect(
      as(ALICE, (tx) => tx.query(`insert into public.documents (title) values ('   ')`)),
    ).rejects.toThrow(/documents_title_length/)
  })

  it('denies anonymous users entirely', async () => {
    await expect(as(null, (tx) => tx.query('select id from public.documents'))).rejects.toThrow(/permission denied/)
  })
})

describe('unauthorized access to private documents', () => {
  it('hides, and blocks edits/deletes of, documents that are not owned or shared', async () => {
    const id = await createDoc(ALICE, 'Private')
    expect(await visibleDocIds(BOB)).not.toContain(id)

    const upd = await as(BOB, (tx) => tx.query(`update public.documents set title = 'pwned' where id = $1`, [id]))
    expect(upd.affectedRows).toBe(0)
    const del = await as(BOB, (tx) => tx.query('delete from public.documents where id = $1', [id]))
    expect(del.affectedRows).toBe(0)

    const { rows } = await as(ALICE, (tx) =>
      tx.query<{ title: string }>('select title from public.documents where id = $1', [id]),
    )
    expect(rows[0].title).toBe('Private')
  })

  it('does not let a non-owner share, or probe emails via, someone else’s document', async () => {
    const id = await createDoc(ALICE)
    await expect(share(BOB, id, 'carol@example.com', 'editor')).rejects.toThrow(/Only the document owner/)
    await expect(
      as(BOB, (tx) =>
        tx.query(`insert into public.document_shares (document_id, shared_with_user_id, permission) values ($1, $2, 'editor')`, [id, BOB]),
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('hides unrelated users’ profiles and share lists', async () => {
    const id = await createDoc(ALICE)
    await share(ALICE, id, 'bob@example.com', 'viewer')
    const profiles = await as(CAROL, (tx) => tx.query<{ email: string }>('select email from public.profiles'))
    expect(profiles.rows.map((r) => r.email)).toEqual(['carol@example.com'])
    const shares = await as(CAROL, (tx) => tx.query('select * from public.document_shares'))
    expect(shares.rows).toHaveLength(0)
  })
})

describe('sharing: viewer vs editor', () => {
  it('viewer can read but not edit, delete, re-share or self-promote', async () => {
    const id = await createDoc(ALICE, 'Shared plan')
    await share(ALICE, id, 'BOB@example.com ', 'viewer') // email match is case/whitespace-insensitive

    expect(await visibleDocIds(BOB)).toContain(id)
    expect(await visibleDocIds(CAROL)).not.toContain(id)

    const upd = await as(BOB, (tx) => tx.query(`update public.documents set title = 'edited' where id = $1`, [id]))
    expect(upd.affectedRows).toBe(0)
    const del = await as(BOB, (tx) => tx.query('delete from public.documents where id = $1', [id]))
    expect(del.affectedRows).toBe(0)
    await expect(share(BOB, id, 'carol@example.com', 'viewer')).rejects.toThrow(/Only the document owner/)
    const promote = await as(BOB, (tx) =>
      tx.query(`update public.document_shares set permission = 'editor' where document_id = $1`, [id]),
    )
    expect(promote.affectedRows).toBe(0)
    const revokeSelf = await as(BOB, (tx) => tx.query('delete from public.document_shares where document_id = $1', [id]))
    expect(revokeSelf.affectedRows).toBe(0)

    // The recipient can see who shared it with them.
    const owner = await as(BOB, (tx) =>
      tx.query<{ email: string }>('select email from public.profiles where id = $1', [ALICE]),
    )
    expect(owner.rows).toEqual([{ email: 'alice@example.com' }])
  })

  it('editor can edit title/content but cannot delete, take ownership or manage shares', async () => {
    const id = await createDoc(ALICE, 'Team notes')
    await share(ALICE, id, 'bob@example.com', 'editor')

    const upd = await as(BOB, (tx) =>
      tx.query(`update public.documents set title = 'Team notes v2' where id = $1`, [id]),
    )
    expect(upd.affectedRows).toBe(1)

    const del = await as(BOB, (tx) => tx.query('delete from public.documents where id = $1', [id]))
    expect(del.affectedRows).toBe(0)
    await expect(
      as(BOB, (tx) => tx.query('update public.documents set owner_id = $1 where id = $2', [BOB, id])),
    ).rejects.toThrow(/permission denied/)
    await expect(share(BOB, id, 'carol@example.com', 'viewer')).rejects.toThrow(/Only the document owner/)
  })

  it('owner can change permission and revoke access', async () => {
    const id = await createDoc(ALICE)
    await share(ALICE, id, 'bob@example.com', 'editor')
    await as(ALICE, (tx) => tx.query(`update public.document_shares set permission = 'viewer' where document_id = $1`, [id]))
    const upd = await as(BOB, (tx) => tx.query(`update public.documents set title = 'x' where id = $1`, [id]))
    expect(upd.affectedRows).toBe(0)

    await as(ALICE, (tx) => tx.query('delete from public.document_shares where document_id = $1', [id]))
    expect(await visibleDocIds(BOB)).not.toContain(id)
  })

  it('rejects duplicate shares, self-shares, unknown emails and invalid permissions', async () => {
    const id = await createDoc(ALICE)
    await share(ALICE, id, 'bob@example.com', 'viewer')
    await expect(share(ALICE, id, 'bob@example.com', 'editor')).rejects.toThrow(/already shared/)
    await expect(share(ALICE, id, 'alice@example.com', 'viewer')).rejects.toThrow(/already own/)
    await expect(share(ALICE, id, 'nobody@example.com', 'viewer')).rejects.toThrow(/No registered user/)
    await expect(
      as(ALICE, (tx) => tx.query(`select public.share_document($1, 'carol@example.com', 'admin')`, [id])),
    ).rejects.toThrow(/viewer or editor/)
  })

  it('deleting a document removes its shares', async () => {
    const id = await createDoc(ALICE)
    await share(ALICE, id, 'bob@example.com', 'viewer')
    await as(ALICE, (tx) => tx.query('delete from public.documents where id = $1', [id]))
    const { rows } = await db.query('select 1 from public.document_shares where document_id = $1', [id])
    expect(rows).toHaveLength(0)
  })
})
