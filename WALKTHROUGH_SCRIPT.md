# Walkthrough Script (3–5 minutes)

**Before recording:** have two reviewer accounts ready (Owner = A, Recipient = B). Open B in a private or incognito window. Have a small `.md` file ready, for example:

```markdown
# Q4 Plan
## Goals
- Ship **sharing**
- Improve *autosave*
1. Write tests
2. Deploy
```

## 1. Intro (≈20 s)

"This is Ajaia Docs, a lightweight document editor with persistent autosave, file import and database-enforced sharing. It is built with React, TypeScript, Tiptap and Supabase. It is not real-time collaboration: saves persist, and others see the latest saved version when they open a document."

## 2. Sign in and create (≈40 s)

- Sign in as **A**. Point out the "My Documents" and "Shared with Me" sections, the search box, and the New and Upload buttons.
- Click **New document**. Rename it to "Launch plan".
- Point at the status indicator as it moves through **Unsaved changes → Saving… → Saved**.

## 3. Format (≈40 s)

- Type a heading and apply **H1**, then a sub-heading with **H2**.
- Apply **bold**, *italic* and underline, using both the toolbar and the keyboard (⌘B / Ctrl+B).
- Add a bulleted list and a numbered list. Show undo and redo.
- Point out that toolbar buttons highlight the active formatting.

## 4. Persistence (≈20 s)

- **Refresh the page.** The same document reopens, because its id is in the URL, and all formatting is intact.

## 5. Import (≈30 s)

- Click **Upload document** and point out the help text: ".txt and .md, up to 1 MB".
- Upload the `.md` file. It becomes a new document titled after the file, with headings and lists converted.
- Try uploading a `.pdf` or `.docx` to show the clear rejection message.

## 6. Share (≈40 s)

- Open "Launch plan", click **Share**, enter B's email and choose **Viewer**.
- Mention that the app prevents duplicate shares and sharing with unknown emails.
- In B's window, refresh or sign in. The document appears under **Shared with Me** ("Can view · A's email").
- Open it as B: it shows **View only**, with no toolbar, no Share and no Delete.

## 7. Editor permission (≈30 s)

- As A, change B to **Editor** in the share dialog.
- As B, reopen the document. B can now edit, and the change autosaves. B still has no Share or Delete.
- As A, reopen the document to see B's edit.

## 8. Authorization is in the database (≈30 s)

- Explain: "Hiding buttons is only UX. Postgres RLS enforces access." Show `supabase/migrations/…init.sql` briefly: the policies, and the column grants that make `owner_id` impossible to set or change from the browser.
- Optional, if safe: as A, remove B's access. B's next refresh shows "Document not available".

## 9. Engineering notes (≈40 s)

- **Autosave:** debounced, with one save in flight at a time and no "Saved" until the database confirms. Failed saves keep the changes and offer Retry. The editor is remounted per document, so a pending save cannot land in the wrong document.
- **Tests:** `npm test` includes RLS tests that run the real migration on PostgreSQL (PGlite), plus autosave, import, serialization and component tests. `npm run test:live` checks the hosted project.
- **AI usage:** built with Claude Code. Mention the RLS mutation testing and the zero-rows-updated "false Saved" case (see AI_WORKFLOW.md).
- **Trade-offs and next steps:** last write wins; next would be optimistic concurrency, Playwright E2E, and invitation-based sharing.
