#!/usr/bin/env node
/**
 * Live integration check against a REAL Supabase project (not mocked, not PGlite).
 *
 * Uses only the public anon key + two existing user accounts, exactly like the
 * browser does, and verifies persistence, sharing and RLS enforcement end-to-end.
 * Creates two temporary documents and deletes them at the end.
 *
 * Required env (put them in .env.local, which is git-ignored):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
 *   SMOKE_A_EMAIL, SMOKE_A_PASSWORD, SMOKE_B_EMAIL, SMOKE_B_PASSWORD
 *
 * Run: npm run test:live
 */
import { createClient } from '@supabase/supabase-js'
import { isDeepStrictEqual } from 'node:util'

const env = process.env
const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SMOKE_A_EMAIL', 'SMOKE_A_PASSWORD', 'SMOKE_B_EMAIL', 'SMOKE_B_PASSWORD']
const missing = required.filter((k) => !env[k])
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')} (see scripts/live-smoke.mjs)`)
  process.exit(2)
}

const newClient = () =>
  createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

async function signIn(email, password) {
  const client = newClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return { client, user: data.user }
}

let failures = 0
async function check(name, fn) {
  try {
    await fn()
    console.log(`  PASS  ${name}`)
  } catch (err) {
    failures++
    console.log(`  FAIL  ${name}\n        ${err instanceof Error ? err.message : err}`)
  }
}
function assert(cond, message) {
  if (!cond) throw new Error(message)
}

const content = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Smoke test' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }, { type: 'underline' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }] },
  ],
}

const a = await signIn(env.SMOKE_A_EMAIL, env.SMOKE_A_PASSWORD)
const b = await signIn(env.SMOKE_B_EMAIL, env.SMOKE_B_PASSWORD)
console.log(`Signed in as A (${a.user.email}) and B (${b.user.email}) against ${new URL(env.VITE_SUPABASE_URL).host}\n`)

const stamp = new Date().toISOString()
let sharedId
let privateId

try {
  await check('A creates a document; owner_id is set by the database', async () => {
    const { data, error } = await a.client.from('documents').insert({ title: `Smoke shared ${stamp}`, content }).select().single()
    if (error) throw error
    sharedId = data.id
    assert(data.owner_id === a.user.id, `owner_id ${data.owner_id} !== ${a.user.id}`)
  })

  await check('formatted content round-trips exactly', async () => {
    const { data, error } = await a.client.from('documents').select('content').eq('id', sharedId).single()
    if (error) throw error
    // jsonb normalizes object key order, so compare structurally, not as strings.
    assert(isDeepStrictEqual(data.content, content), 'content differs after reload')
  })

  await check('client cannot supply owner_id on insert', async () => {
    const { error } = await a.client.from('documents').insert({ title: 'x', owner_id: b.user.id })
    assert(error, 'insert with owner_id unexpectedly succeeded')
  })

  await check('B cannot read, edit or delete A’s private document', async () => {
    const { data, error } = await a.client.from('documents').insert({ title: `Smoke private ${stamp}` }).select('id').single()
    if (error) throw error
    privateId = data.id
    const read = await b.client.from('documents').select('id').eq('id', privateId)
    assert(!read.error && read.data.length === 0, 'B can see the private document')
    const upd = await b.client.from('documents').update({ title: 'pwned' }).eq('id', privateId).select('id')
    assert(!upd.error && upd.data.length === 0, 'B updated the private document')
    const del = await b.client.from('documents').delete().eq('id', privateId).select('id')
    assert(!del.error && del.data.length === 0, 'B deleted the private document')
  })

  await check('B cannot share A’s document', async () => {
    const { error } = await b.client.rpc('share_document', { p_document_id: sharedId, p_email: env.SMOKE_B_EMAIL, p_permission: 'editor' })
    assert(error, 'non-owner share unexpectedly succeeded')
  })

  await check('A shares with B as viewer; B sees it under shared documents', async () => {
    const { error } = await a.client.rpc('share_document', { p_document_id: sharedId, p_email: env.SMOKE_B_EMAIL, p_permission: 'viewer' })
    if (error) throw error
    const { data, error: e2 } = await b.client.from('document_shares').select('permission, document:documents (id, title)').eq('shared_with_user_id', b.user.id)
    if (e2) throw e2
    assert(data.some((s) => s.document?.id === sharedId && s.permission === 'viewer'), 'shared document not visible to B')
  })

  await check('duplicate share is rejected', async () => {
    const { error } = await a.client.rpc('share_document', { p_document_id: sharedId, p_email: env.SMOKE_B_EMAIL, p_permission: 'editor' })
    assert(error && /already shared/.test(error.message), `expected duplicate error, got ${error?.message}`)
  })

  await check('viewer B cannot edit or self-promote', async () => {
    const upd = await b.client.from('documents').update({ title: 'viewer edit' }).eq('id', sharedId).select('id')
    assert(!upd.error && upd.data.length === 0, 'viewer was able to edit')
    const promote = await b.client.from('document_shares').update({ permission: 'editor' }).eq('document_id', sharedId).select('id')
    assert(!promote.error && promote.data.length === 0, 'viewer promoted themselves')
  })

  await check('after upgrade to editor, B can edit but not delete or take ownership', async () => {
    const up = await a.client.from('document_shares').update({ permission: 'editor' }).eq('document_id', sharedId).select('id')
    assert(!up.error && up.data.length === 1, 'owner could not change permission')
    const upd = await b.client.from('documents').update({ title: `Edited by B ${stamp}` }).eq('id', sharedId).select('title')
    assert(!upd.error && upd.data.length === 1, `editor could not edit: ${upd.error?.message}`)
    const del = await b.client.from('documents').delete().eq('id', sharedId).select('id')
    assert(!del.error && del.data.length === 0, 'editor deleted the document')
    const own = await b.client.from('documents').update({ owner_id: b.user.id }).eq('id', sharedId)
    assert(own.error, 'editor changed owner_id')
  })

  await check('anonymous requests cannot read documents', async () => {
    const { data, error } = await newClient().from('documents').select('id').limit(1)
    assert(error || data.length === 0, 'anon read returned rows')
  })
} finally {
  for (const id of [sharedId, privateId].filter(Boolean)) {
    const { error } = await a.client.from('documents').delete().eq('id', id)
    if (error) console.log(`  (cleanup failed for ${id}: ${error.message})`)
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll live checks passed.')
process.exit(failures ? 1 : 0)
