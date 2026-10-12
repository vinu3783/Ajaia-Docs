# Architecture

## Overview

```
Browser (React SPA on Vercel)
  │  supabase-js, using the anon key + the user's JWT
  ▼
Supabase
  ├─ Auth (email/password)  → issues the JWT; auth.uid() = the user's id
  ├─ PostgREST (Data API)   → turns table/RPC calls into SQL, run as role "authenticated"
  └─ Postgres               → grants + Row Level Security decide what each request can do
```

There is no custom backend. The browser talks to Supabase directly. This is safe only because **every authorization decision is made inside Postgres**. The UI hides controls for convenience, but the database enforces the same rules on its own.

## Frontend

- `features/auth`: `AuthProvider` restores the persisted session (`getSession`) and follows `onAuthStateChange`. `App` remounts the workspace per user id (`key={user.id}`), so one user's in-memory state can never carry over to another user after sign-out.
- `features/documents`: `documentsApi.ts` is the only module that queries documents. Each function takes the client as a parameter so it can be tested. `Workspace` owns the lists and the selection. The selected id is mirrored to `?doc=` with `pushState`, so refresh and back/forward both work.
- `features/editor`: `extensions.ts` is the single schema definition, shared by the UI, the import pipeline and the tests. `DocumentEditor` renders the title, status, toolbar and Tiptap editor. `Toolbar` uses `useEditorState` so it re-renders only when the active marks or nodes change.
- `features/import`: validation and conversion to Tiptap JSON. This module has no React code.
- `features/sharing`: `sharingApi.ts`, `ShareDialog`, and `permissions.ts`, which maps a role to UI capabilities.

## Database schema

| Table | Columns | Notes |
| --- | --- | --- |
| `profiles` | `id` (PK, FK `auth.users`, cascade), `email`, `created_at` | Kept in sync by a trigger on `auth.users`. Unique on `lower(email)`. |
| `documents` | `id` uuid PK, `owner_id` (FK profiles, default `auth.uid()`), `title`, `content` jsonb, `created_at`, `updated_at` | `title` is 1–200 chars after trimming. `content` must be a JSON object with `type = 'doc'` and at most 5 MB of text. Index on `(owner_id, updated_at desc)`. |
| `document_shares` | `id`, `document_id` (FK, cascade), `shared_with_user_id` (FK profiles, cascade), `permission` (`viewer`\|`editor`), `created_at` | `unique (document_id, shared_with_user_id)` prevents duplicate shares. Index on `shared_with_user_id`. |

A `BEFORE UPDATE` trigger on `documents` sets `updated_at` and raises an error if `owner_id` changes.

## Authentication and access control

The defence has three layers:

1. **Grants (column level).** `anon` has no privileges at all. `authenticated` may `INSERT`/`UPDATE` only `documents(title, content)` and only `document_shares.permission` (plus the insert columns). As a result the browser cannot set or change `owner_id` (the error is *permission denied*). It always comes from the `auth.uid()` default.
2. **RLS policies.**
   - documents `SELECT`: the owner, or anyone with a share.
   - `INSERT`: `owner_id = auth.uid()`.
   - `UPDATE`: the owner, or a share with `permission = 'editor'` (checked in both `USING` and `WITH CHECK`).
   - `DELETE`: the owner only.
   - document_shares `SELECT`: the recipient or the document owner.
   - `INSERT`/`UPDATE`/`DELETE`: the document owner only. Inserts also require `shared_with_user_id <> auth.uid()`.
   - profiles `SELECT`: yourself, plus people you share a document with in either direction. This lets owners see recipients and recipients see owners. No one else's email is visible.
3. **Trigger.** This is a backstop against `owner_id` changes even if a grant is loosened later. Removing the column grant during mutation testing showed the trigger still blocking the change.

**Recursion.** The `documents` policies need to read `document_shares`, and vice versa. Writing those as inline subqueries would make RLS recurse. Instead, the cross-table checks live in small `SECURITY DEFINER` functions in a `private` schema: `is_document_owner`, `document_share_permission` and `can_view_profile`. Each has `search_path = ''` and answers a question only about the calling user. The `private` schema is not exposed through the Data API.

**Sharing by email.** Clients cannot read `auth.users`. The public `share_document(doc, email, permission)` RPC is `SECURITY INVOKER`. It first checks that the caller owns the document (so non-owners cannot probe emails). It then resolves the email through a privileged `private.find_user_id_by_email` and performs the `INSERT` **under the caller's RLS**. Duplicates, self-shares, unknown emails and invalid permissions raise readable errors.

### Security assumptions

- The anon key is public. Only the `service_role` key bypasses RLS, and it is never used by this app.
- Supabase Auth issues trustworthy JWTs, and `auth.uid()` reflects the signed-in user.
- Only the `public` schema is exposed via the Data API.
- An owner can learn whether an email is registered by attempting to share with it. This is an accepted demo trade-off.
- RLS hides rows rather than raising errors. For example, a viewer's `UPDATE` matches zero rows. The client therefore treats "0 rows affected" as a failure (`AccessLostError`), so a user whose access was revoked never sees a false "Saved".

## Document persistence and autosave

Content is stored as Tiptap/ProseMirror JSON in `jsonb`. It is never stored or rendered as HTML. On load, the JSON is validated with `isDocJSON` and parsed with `enableContentCheck`. If content does not fit the schema, editing is disabled so autosave cannot overwrite data it failed to read.

`AutosaveController` (`features/editor/autosave.ts`) is a plain class with no React dependency, so it is unit-tested with fake timers:

- Each edit merges into a pending patch (`{title?, content?}`) and restarts an 800 ms debounce.
- At most **one save is in flight**. Edits made during a save are queued and sent afterwards. Responses cannot arrive out of order, so an older snapshot can never overwrite a newer one.
- The status becomes `saved` only after the request resolves **and** nothing newer is pending.
- On failure, the failed patch is merged back *under* any newer edits and the status becomes `error` with a Retry button. The next edit retries automatically. A `beforeunload` prompt warns about unsaved or in-flight changes.

**Switching documents.** `DocumentView` is rendered with `key={documentId}`, so the editor and autosave controller are recreated for each document. Each controller's `save` is bound to one document id. On unmount, the controller flushes any pending edit to *its own* document, so content cannot move from one document to another. Late load responses for a previous document are ignored using a cancelled flag.

## File import

The flow is: `<input accept=".txt,.md,...">` → `validateImportFile` → `TextDecoder('utf-8', {fatal:true})` → convert → `createDocument`.

`validateImportFile` checks the extension, rejects an explicit MIME mismatch, and rejects files that are empty or larger than 1 MB. The UTF-8 decoder rejects invalid encodings. The importer also rejects files containing NUL bytes (binary) and files with no text. Nothing is truncated: a file is either imported completely or rejected.

`.txt` files become one paragraph per line, so blank lines are kept. `.md` files go through `markdownToDoc`, a small line-based converter that builds Tiptap JSON directly. It never creates or parses HTML, so `<script>` or `<img onerror>` in a file stays literal text. A test confirms this. The filename, without its extension, becomes the title.

## Page layout, print and export

- **Pagination.** This is real block-level pagination, not an overlay.
  - `paginationExtension.ts` is a ProseMirror plugin. After each change (batched to one `requestAnimationFrame`), it measures every *unit*: each top-level block, and each item of a list.
  - It subtracts the spacers it has already inserted, giving each unit's natural position. It then passes those positions to `paginate()` in `pageLayout.ts`, a pure function with unit tests.
  - Any unit that would cross the bottom of a page's 931 px content area is pushed to the top of the next page by a **widget decoration**: a non-editable spacer whose height covers the rest of the page, the bottom margin, a 20 px grey gap, and the next page's top margin. The spacer paints only the grey gap, which bleeds past the sheet edges to hide its shadow, so the two sheets look separate.
  - Spacers are decorations, so they are **never saved** in the document, never enter undo history, and never trigger autosave (the plugin's transactions don't change the document).
  - A unit taller than a whole page is left in place, since it can't fit anywhere. Pagination is turned off below 640 px wide, where the sheet isn't A4-sized.
  - `PagedSheet` sets the sheet's minimum height to `pages × 1123 + (pages − 1) × 20`.
- **Why block-level.** Splitting a paragraph line by line across pages, as Google Docs does, needs a layout engine that lays text out into separate page boxes. That is much more work and risk than this assignment's scope allows.
- **Print.** `@page { size: A4; margin: 25.4mm }`, matching the 96 px screen margins. When printing, spacers are hidden and each block that starts a page on screen gets `break-before: page` through a node decoration. Printed pages therefore break exactly where the screen does. Verified in headless Chrome: 3 pages on screen and 3 in the PDF, with page 2 starting at the same list item. Print-only utilities hide the sidebar, header and toolbar, and remove the fixed-height app shell so nothing is clipped.
- **Export.** This is entirely client-side. A Blob is downloaded through a temporary `<a download>` link. HTML export wraps `editor.getHTML()`, which can only contain node types from the schema, and escapes the title. Markdown export (`docToMarkdown`) is the inverse of the importer. It escapes text that would otherwise be read as Markdown syntax. A test checks that export followed by import gives back the same document.
- **Make a copy** inserts a new document with the on-screen content, including edits that haven't been saved yet. Because it goes through the normal insert under RLS, the copy is always owned by the person copying, even if they were only a viewer of the original.

## Font size

`TextStyle` + `FontSize` from `@tiptap/extension-text-style` store sizes as a `textStyle` mark, for example `{ fontSize: "14pt" }`. Choosing the block's default size removes the mark instead of storing it. When a document loads, `sanitizeDoc` drops any font size outside 6–96 pt or not in `Npt` form. This adds to Tiptap's own guard, which already rejects `;`, `{` and `}` in style values.

## Trade-offs

- **No custom server.** RLS keeps the system small and puts authorization in one place. The cost is that business rules live in SQL, which is why the RLS tests run on real Postgres.
- **Hand-written types** instead of generated Supabase types. This avoids needing the CLI and a linked project during development.
- **Last-write-wins** instead of version checks or CRDTs. This is acceptable given the explicit "no real-time collaboration" scope.
- **A custom Markdown subset** instead of a Markdown-to-HTML library followed by HTML parsing. It adds no dependency and has no HTML injection surface, but supports fewer Markdown features.

## With another 2–4 hours

1. Optimistic concurrency: send the `updated_at` the client last saw and reject stale writes. Show a "document changed elsewhere — reload" prompt instead of silently overwriting.
2. A Playwright end-to-end suite against a disposable Supabase project, run in CI.
3. Supabase Realtime to refresh the shared list and show "updated by X" notices.
4. Invitation-based sharing, to remove email enumeration and allow sharing with not-yet-registered users.
5. Code-split the editor bundle, and export to `.md` and `.txt`.
