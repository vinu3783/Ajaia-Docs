# Submission: Ajaia Docs

| | |
| --- | --- |
| **Project** | Ajaia Docs, a lightweight document editor with sharing |
| **Live URL** | _Not deployed yet._ Needs a Supabase project and a Vercel account (see "Deployment status"). |
| **Source repository** | _Not published yet._ Local git repository only, no remote configured. |
| **Walkthrough video** | _Not recorded yet._ See `WALKTHROUGH_URL.txt` and `WALKTHROUGH_SCRIPT.md`. |

## Inventory

| Path | Contents |
| --- | --- |
| `src/` | React + TypeScript application (see the README's "Project structure") |
| `supabase/migrations/20261012000000_init.sql` | Schema, grants, RLS policies, helpers and the `share_document` RPC |
| `supabase/tests/` | PGlite RLS tests and the Supabase `auth` shim |
| `scripts/live-smoke.mjs` | Integration checks against a real Supabase project |
| `README.md` | Setup, environment, Supabase, tests, deployment and limitations |
| `ARCHITECTURE.md` | Architecture, schema, security model, autosave, import and trade-offs |
| `AI_WORKFLOW.md` | How AI was used and verified |
| `WALKTHROUGH_SCRIPT.md` | Recording outline |
| `WALKTHROUGH_URL.txt` | Video link (placeholder for now) |
| `screenshots/` | Real screenshots only (to be captured from the running app) |
| `.env.example` | Environment variable names only |

## Feature checklist

"Verified" below means verified by automated tests and a successful build. A manual browser pass against a live Supabase project has **not** been done yet.

| Feature | Status | Evidence |
| --- | --- | --- |
| Sign-up / sign-in / sign-out / session restore | Implemented | Built and type-checked. Not yet exercised against live Supabase. |
| Create document | Implemented | Component test; PGlite RLS test |
| Rename / edit title (1–200 chars, blank rejected) | Implemented | Component test; DB constraint test |
| Rich text: bold, italic, underline, H1, H2, paragraph, bulleted and numbered lists, undo/redo | Implemented | Serialization and toolbar tests |
| Formatting survives save and reload | Implemented | JSON round-trip through a real Tiptap editor; jsonb round-trip in PGlite |
| Debounced autosave with truthful status and retry | Implemented | 5 controller tests, 2 component tests |
| Safe document switching (no cross-document overwrite) | Implemented | Remount per document; flush-on-dispose test |
| My Documents / Shared with Me / search | Implemented | Component test |
| Delete (owner only, with confirmation) | Implemented | RLS tests (non-owners cannot delete). The UI confirm dialog is not covered by an automated test. |
| `.txt` / `.md` import with validation | Implemented | 14 import tests |
| Markdown formatting on import | Partial (subset) | Headings, lists, inline marks, quotes, code and rules. Nested lists are flattened. |
| Share by email as viewer or editor; change or remove access | Implemented | 15 RLS tests on Postgres |
| Viewer read-only / editor can edit / only owner shares or deletes | Implemented | RLS tests plus component tests |
| Ownership cannot be changed by the client | Implemented | Column grants plus trigger, both tested |
| Responsive layout with mobile drawer | Implemented | Not visually verified in a browser yet |
| Real-time collaboration | Not implemented | Out of scope; last write wins |
| Deployment | Not done | Blocked on external accounts |

## Test results (actual)

Run locally on 2026-10-12 with Node 24.4.1:

```
$ npm test
 Test Files  8 passed (8)
      Tests  54 passed (54)

  15  supabase/tests/rls.test.ts            (real Postgres via PGlite; emulated Supabase auth)
  14  src/features/import/importFile.test.ts
   6  src/features/editor/DocumentEditor.test.tsx   (API mocked)
   5  src/features/documents/Workspace.test.tsx     (API mocked)
   5  src/features/documents/documentsApi.test.ts   (fake client)
   5  src/features/editor/autosave.test.ts
   3  src/features/editor/serialization.test.ts
   1  src/features/sharing/permissions.test.ts

$ npm run lint        → no problems
$ npm run typecheck   → no errors
$ npm run build       → success (JS 580 kB / 184 kB gzip; Vite warns about the >500 kB chunk)
```

`npm run test:live` (hosted Supabase): **not run yet.** It needs a project and two accounts.

The RLS tests were mutation-checked. Three deliberate weakenings of the migration each caused failures (details in AI_WORKFLOW.md).

## Deployment status

Not deployed. The remaining manual steps are listed in README → "Supabase setup" and "Deployment (Vercel)". After deploying:

1. Run `npm run test:live` against the project.
2. Walk through the main flows in a fresh browser session.
3. Fill in the live URL above.

## Reviewer accounts

No credentials are committed. Create two users as described in README → "Reviewer test accounts". Supabase dashboard → Authentication → Add user → **Auto Confirm User** is the quickest way. Credentials, if provided to reviewers, should be shared privately and not in this repository.

## Known limitations

See README → "Known limitations". In short: no real-time collaboration (last write wins); sharing reveals whether an email is registered; Markdown import supports a subset of the syntax; recipients cannot remove documents from their own shared list; no version history or export.
