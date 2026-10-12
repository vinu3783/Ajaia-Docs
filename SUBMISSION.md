# Submission: Ajaia Docs

| | |
| --- | --- |
| **Project** | Ajaia Docs, a lightweight document editor with sharing |
| **Live URL** | https://ajaia-docs-olive-one.vercel.app/ (Vercel; backend is a hosted Supabase project) |
| **Source repository** | https://github.com/vinu3783/Ajaia-Docs |
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

"Verified" below means verified by automated tests and a successful build. The database rules were also verified against the hosted Supabase project with `npm run test:live`. The deployed site was also checked end-to-end in real Chrome with two separate user sessions (see "Deployment status").

| Feature | Status | Evidence |
| --- | --- | --- |
| Sign-up / sign-in / sign-out / session restore | Implemented | Password sign-in verified against live Supabase (`test:live`). The browser UI flow is not yet manually verified. |
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
| Share by email as viewer or editor; change or remove access | Implemented | 15 RLS tests on Postgres; live checks on hosted Supabase |
| Viewer read-only / editor can edit / only owner shares or deletes | Implemented | RLS tests plus component tests |
| Ownership cannot be changed by the client | Implemented | Column grants plus trigger, both tested |
| Responsive layout with mobile drawer | Implemented | Headless Chrome at 390 px wide: no horizontal overflow (screenshot reviewed) |
| A4 pages with gaps (block-level pagination) | Implemented | Unit tests for `paginate`. Headless Chrome against live Supabase: 41 blocks, 0 crossing a page boundary; 3 pages on screen = 3 in the PDF, with the same break points. |
| Font size control (pt) | Implemented | Component test, serialization test, sanitizer test. Headless Chrome: 24 pt applied, still 24 pt after reload. |
| Print / Save as PDF on A4 | Implemented | Headless Chrome PDF: A4 paper (595 × 842 pt); page breaks match the screen |
| Download as .md / .txt / .html | Implemented | Unit tests (Markdown export → import round-trip) and a component test |
| Make a copy ("Save as") | Implemented | Component test; headless Chrome against live Supabase (copy opened with full content) |
| Line-level pagination (splitting a paragraph across pages) | Not implemented | Paragraphs move to the next page whole |
| Real-time collaboration | Not implemented | Out of scope; last write wins |
| Deployment | Done | Vercel (frontend) + Supabase (Auth, Postgres, RLS); verified end-to-end on the live URL |

## Test results (actual)

Run locally on 2026-10-12 with Node 24.4.1:

```
$ npm test
 Test Files  10 passed (10)
      Tests  70 passed (70)

  15  supabase/tests/rls.test.ts            (real Postgres via PGlite; emulated Supabase auth)
  14  src/features/import/importFile.test.ts
   9  src/features/editor/DocumentEditor.test.tsx   (API mocked)
   6  src/features/documents/Workspace.test.tsx     (API mocked)
   5  src/features/documents/documentsApi.test.ts   (fake client)
   5  src/features/editor/autosave.test.ts
   5  src/features/editor/serialization.test.ts
   1  src/features/sharing/permissions.test.ts
   5  src/features/export/exportDocument.test.ts    (incl. Markdown export → import round-trip)
   5  src/features/editor/pageLayout.test.ts

$ npm run lint        → no problems
$ npm run typecheck   → no errors
$ npm run build       → success (JS 884 kB / 266 kB gzip with Supabase configured; Vite warns about the >500 kB chunk)
```

`npm run test:live` against the hosted Supabase project (2026-10-12), as two real reviewer accounts using the publishable key:

```
  PASS  A creates a document; owner_id is set by the database
  PASS  formatted content round-trips exactly
  PASS  client cannot supply owner_id on insert
  PASS  B cannot read, edit or delete A's private document
  PASS  B cannot share A's document
  PASS  A shares with B as viewer; B sees it under shared documents
  PASS  duplicate share is rejected
  PASS  viewer B cannot edit or self-promote
  PASS  after upgrade to editor, B can edit but not delete or take ownership
  PASS  anonymous requests cannot read documents
All live checks passed.
```

The first run failed the round-trip check. This was a test bug: `jsonb` reorders object keys, and the check compared JSON strings. Deep equality was `true`. The check was fixed to compare structurally and re-run (see AI_WORKFLOW.md).

The RLS tests were mutation-checked. Three deliberate weakenings of the migration each caused failures (details in AI_WORKFLOW.md).

## Deployment status

**Deployed:** https://ajaia-docs-olive-one.vercel.app/, built by Vercel from `main` of https://github.com/vinu3783/Ajaia-Docs.

The only environment variables set in Vercel are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the publishable key. The deployed JavaScript bundle was checked: it contains the project URL and the publishable key, and no secret or service-role key.

**Live end-to-end check (2026-10-12).** Headless Chrome ran two *isolated* browser sessions against the deployed URL: the owner account and the recipient account. The script created its own test documents and deleted them afterwards.

```
PASS  owner signs in on the live site
PASS  document, title and formatting persist after reload
PASS  owner shares as viewer; duplicate share is refused
PASS  recipient sees the document under "Shared with Me"
PASS  viewer: read-only, no toolbar/share/delete
PASS  recipient cannot open an unshared document by URL
PASS  editor: can edit and autosave, still no share/delete
PASS  owner sees the editor's change after reopening
PASS  Markdown upload creates a formatted document
console errors: none — ALL LIVE CHECKS PASSED
```

`npm run test:live` checks the same database rules directly through the Data API (10/10, see above). Not yet done by a person: a manual walkthrough on a phone, and the walkthrough recording.

## Reviewer accounts

No credentials are committed. Create two users as described in README → "Reviewer test accounts". Supabase dashboard → Authentication → Add user → **Auto Confirm User** is the quickest way. Credentials, if provided to reviewers, should be shared privately and not in this repository.

## Known limitations

See README → "Known limitations". In short: no real-time collaboration (last write wins); sharing reveals whether an email is registered; Markdown import supports a subset of the syntax; recipients cannot remove documents from their own shared list; no version history or export.
