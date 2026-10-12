<div align="center">

<img src="public/favicon.svg" width="72" alt="Ajaia Docs logo" />

# Ajaia Docs

**A lightweight, Google Docs–style document editor with autosave, A4 pages, file import and secure sharing.**

[![Live demo](https://img.shields.io/badge/Live_demo-Open_app-2563eb?style=for-the-badge&logo=vercel&logoColor=white)](https://ajaia-docs-olive-one.vercel.app/)
[![Walkthrough video](https://img.shields.io/badge/Video-Watch_walkthrough-625df5?style=for-the-badge&logo=loom&logoColor=white)](https://www.loom.com/share/5ea3aab7624e4789a206aebd67406f8e)

![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06b6d4?logo=tailwindcss&logoColor=white)
![Tiptap](https://img.shields.io/badge/Tiptap_3-0d0d0d?logo=tiptap&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_·_Auth_·_RLS-3ecf8e?logo=supabase&logoColor=white)
![Tests](https://img.shields.io/badge/tests-70_passing-22c55e)

</div>

---

## 🎬 Walkthrough

<div align="center">

[![Watch the 4-minute walkthrough](screenshots/00-video-preview.png)](https://www.loom.com/share/5ea3aab7624e4789a206aebd67406f8e)

*Click to watch the walkthrough on Loom: creating and formatting a document, import, sharing as viewer/editor, and how access is enforced in the database.*

</div>

## 📸 Screenshots

<table>
  <tr>
    <td width="50%"><img src="screenshots/02-owner-editor.png" alt="Owner editing a document" /><br /><sub><b>Editor</b>: A4 page, formatting toolbar, font size, live “Saved” status</sub></td>
    <td width="50%"><img src="screenshots/03-share-dialog.png" alt="Share dialog" /><br /><sub><b>Sharing</b>: invite by email as Viewer or Editor, change or remove access</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="screenshots/04-recipient-editor-access.png" alt="Recipient with edit access" /><br /><sub><b>Shared with Me</b>: the recipient can edit, but cannot share or delete</sub></td>
    <td width="50%"><img src="screenshots/05-recipient-view-only.png" alt="View-only document" /><br /><sub><b>View only</b>: no toolbar, read-only, enforced by the database</sub></td>
  </tr>
</table>

## ✨ Features

| | |
| --- | --- |
| 📝 **Rich-text editing** | Bold, italic, underline, H1/H2, bulleted and numbered lists, **font size** (pt) and undo/redo. Keyboard shortcuts work, and toolbar buttons show the active formatting. |
| 📄 **A4 pages** | Separate A4 sheets with a gap between them, like Google Docs. Blocks that would cross a page move to the next one, and **printing breaks at the same places**. |
| 💾 **Truthful autosave** | *Unsaved changes → Saving… → Saved*, shown only after the database confirms the write. Failed saves keep your edits and offer **Retry**. |
| 📥 **Import** | `.txt` and `.md` files up to 1 MB. Markdown headings, lists and inline formatting become real formatting. Unsupported files are rejected clearly. |
| 📤 **File menu** | Download as Markdown, plain text or HTML; **Print / Save as PDF** on A4; **Make a copy** (Save as). |
| 🤝 **Sharing** | Share by email as **Viewer** or **Editor**. The owner can change or remove access, and duplicate shares are prevented. |
| 🔒 **Real security** | Permissions are enforced in **PostgreSQL Row Level Security** and column grants, not by hiding buttons. No one can take ownership or open a document that wasn't shared with them. |
| 🔐 **Accounts** | Email/password sign-up and sign-in (Supabase Auth). The session is restored on reload. |
| 📱 **Responsive** | On phones, the sidebar becomes a drawer. |

> **Scope note:** this is persistent sharing, not real-time co-editing. If two people edit at the same time, the last save wins. See [ARCHITECTURE.md](ARCHITECTURE.md).

## 🔗 Links

| | |
| --- | --- |
| 🌐 Live app | https://ajaia-docs-olive-one.vercel.app/ |
| 🎬 Walkthrough video | https://www.loom.com/share/5ea3aab7624e4789a206aebd67406f8e |
| 🏗️ Architecture and security model | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 🤖 How AI was used and verified | [AI_WORKFLOW.md](AI_WORKFLOW.md) |
| ✅ Feature status and test results | [SUBMISSION.md](SUBMISSION.md) |

## Tech stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Tiptap 3 (StarterKit), Supabase (Postgres, Auth, RLS) and `@supabase/supabase-js`. Tests use Vitest, React Testing Library and PGlite (Postgres compiled to WASM) for the database tests. There is no custom backend server.

## Prerequisites

- Node.js 20.19 or newer (developed on Node 24) and npm
- A Supabase project (the free tier is fine)
- Optional: a Vercel account for deployment

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values below
npm run dev                  # http://localhost:5173
```

If the environment variables are missing, the app shows a "Supabase is not configured" screen instead of crashing.

### Environment variables

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` / publishable key |

Only the **public** anon/publishable key goes in the frontend. It is safe to expose because every table is protected by RLS. **Never** put the `service_role`/secret key in `.env.local`, Vercel or the repository.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema. Open **SQL Editor**, paste the full contents of [`supabase/migrations/20261012000000_init.sql`](supabase/migrations/20261012000000_init.sql) and run it. If you use the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.
3. Under **Authentication → Providers → Email**, keep Email enabled. For a frictionless demo you can turn off **Confirm email**. If you leave it on, new users must click the confirmation link before they can sign in. The built-in mailer is rate-limited.
4. Under **Authentication → URL Configuration**, set **Site URL** to your deployed URL (or `http://localhost:5173` for local use) so confirmation links point back to the app.

The migration creates `profiles`, `documents` and `document_shares`, plus the RLS policies, column-level grants, helper functions and the `share_document` RPC. It also backfills a profile for any users that already exist.

### Reviewer test accounts

No credentials are committed to this repository. Create two accounts in either of these ways:

- **Dashboard:** go to Authentication → Users → *Add user* → *Create new user*, enter an email and a strong password, and tick **Auto Confirm User**. Do this twice, for example `reviewer.owner@<your-domain>` and `reviewer.recipient@<your-domain>`.
- **In the app:** click *Create an account* on the sign-in screen. This works without extra steps when **Confirm email** is off.

A profile row is created automatically for every new user by a trigger. Sharing is by email, so the recipient must have signed up first.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server. |
| `npm run build` | Type-checks (`tsc -b`) and builds the production bundle into `dist/`. |
| `npm run preview` | Serves the production build locally. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Runs the TypeScript project build with no output. |
| `npm test` | Runs all automated tests: unit, component and PGlite RLS tests. No network is needed. |
| `npm run test:live` | Runs integration checks against your **real** Supabase project (see below). |

### Tests

`npm test` runs three kinds of tests. They prove different things:

1. **Database authorization (`supabase/tests/rls.test.ts`).** These run the real migration on real PostgreSQL (PGlite). Queries execute as the `authenticated` role with a per-request `auth.uid()`, which is how Supabase evaluates RLS. They cover owner, viewer, editor and unrelated-user access, ownership changes, duplicate shares and anonymous access. A small shim emulates Supabase's `auth` schema and default grants ([`supabase/tests/supabase-shim.sql`](supabase/tests/supabase-shim.sql)). Because of that shim, these tests are not a test of a hosted Supabase instance.
2. **Unit tests.** These cover autosave timing and race handling, file validation, Markdown conversion, rich-text JSON round-trips through a real headless Tiptap editor, permission rules, and the data-access layer with a fake client.
3. **Component tests (React Testing Library).** These cover creating a document, the list and search, rejected and accepted uploads, viewer read-only mode, editor mode, autosave status and the toolbar. The API layer is mocked in these tests, so they verify UI behaviour only.

`npm run test:live` ([`scripts/live-smoke.mjs`](scripts/live-smoke.mjs)) signs in as two real users with the anon key and checks the following against the hosted database: persistence, formatting round-trip, sharing, viewer and editor rules, protection of private documents, and that anonymous users are denied. It needs these variables in `.env.local`:

```
SMOKE_A_EMAIL=...  SMOKE_A_PASSWORD=...  SMOKE_B_EMAIL=...  SMOKE_B_PASSWORD=...
```

It creates two temporary documents and deletes them at the end.

## Deployment (Vercel)

1. Push the repository to GitHub, GitLab or Bitbucket and click **Import** in Vercel. Alternatively, run `npx vercel` from the project root.
2. Vercel detects the framework as **Vite**: the build command is `npm run build` and the output directory is `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables**, for Production and Preview. Then redeploy, because Vite inlines these values at build time.
4. In Supabase, set **Site URL** to the Vercel URL (see Supabase setup, step 4).
5. In a fresh browser session, sign in as each reviewer account and walk through the flows.

No rewrites are needed, because the app uses a query parameter (`?doc=`) rather than client-side routes.

## Project structure

```
src/
  components/          Shared UI: Modal, ConfirmDialog, Spinner, Logo
  features/
    auth/              AuthProvider (session restore), AuthScreen
    documents/         Data access (documentsApi), Workspace, Sidebar, DocumentView
    editor/            Tiptap config, Toolbar, FontSizeControl, AutosaveController, DocumentEditor, A4 pagination (pageLayout + paginationExtension)
    export/            Markdown/text/HTML export, File menu
    import/            File validation and Markdown/plain text → Tiptap JSON
    sharing/           sharingApi, ShareDialog, permission → UI capabilities
  lib/                 Supabase client, error messages
  types/               Shared domain types
  test/                Test setup and helpers
supabase/
  migrations/          Version-controlled schema and RLS
  tests/               PGlite RLS tests and Supabase shim
scripts/live-smoke.mjs Integration checks against a real Supabase project
```

## Known limitations

- **No real-time collaboration or conflict resolution.** Concurrent editors overwrite each other (last write wins). Others see changes only when they open or reopen the document. Refocusing the window refreshes the document *lists*, not an open document.
- **Email enumeration.** The owner of any document can learn whether an email address is registered, because sharing with an unknown address returns an error. This is acceptable for a demo. Invitations would remove it.
- **Markdown import is a subset.** Nested lists are flattened. Tables, links and images are kept as literal text. Headings deeper than H3 become H3. Only `.txt` and `.md` are supported; `.docx` and `.pdf` are not.
- **Limited sharing actions for recipients.** A recipient cannot remove a document from their own "Shared with Me" list; only the owner can revoke access. There is no ownership transfer and no link sharing.
- **Pagination works per block.** A paragraph moves to the next page as a whole; it is never split line by line the way Google Docs does it, so a long paragraph near the end of a page can leave white space. A single paragraph taller than a whole page can't fit anywhere, so it runs across the gap. Page layout applies only on screens 640 px wide or more; on phones the document is one continuous sheet.
- **Font sizes are not exported to Markdown or plain text**, because neither format has a way to represent them. HTML export and printing keep them.
- **Markdown export** writes underline as `<u>…</u>`, because Markdown has no underline syntax. The app's importer reads it back as underline. Nested lists are exported with indentation but flattened on re-import.
- **No version history.**
- The production JavaScript bundle is 884 kB (266 kB gzipped) in a single chunk, mostly react-dom, supabase-js and Tiptap/ProseMirror. Code-splitting the editor and auth screens would reduce the initial load.
- Large documents (close to the 1 MB import limit) serialize the full document JSON on every autosave.
