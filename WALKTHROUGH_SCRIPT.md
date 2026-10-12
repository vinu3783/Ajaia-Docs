# Ajaia Docs: Walkthrough Video Script

**Length:** about 4½ minutes · **Live app:** https://ajaia-docs-olive-one.vercel.app/ · **Code:** https://github.com/vinu3783/Ajaia-Docs

Each step has **DO** (what to click) and **SAY** (what to read out). Speak slowly. If you make a mistake, keep going; it doesn't need to be perfect.

---

## Before you press record (5 minutes of setup)

- [ ] **Window 1** (normal Chrome): open the live app and sign in as **Owner**, `vinayakagcowner@gmail.com`.
- [ ] **Window 2** (incognito, ⌘⇧N): open the live app, but **don't sign in yet**. This will be the **Viewer**, `vinayakagcviewer@gmail.com`.
- [ ] Put both windows side by side, or switch with ⌘` .
- [ ] On the Desktop, save a file called **`Team Plan.md`** with this content:

  ```markdown
  # Team Plan
  ## Goals
  - Ship **sharing**
  - Improve *autosave*
  1. Write tests
  2. Deploy
  ```
- [ ] Have any `.pdf` file ready on the Desktop. It will be rejected on purpose.
- [ ] In VS Code, open `supabase/migrations/20261012000000_init.sql` and scroll to the **Row Level Security** section.
- [ ] Close notifications (Focus mode on) and zoom the browser to 100–110%.

---

## 1. Introduction · 0:00–0:20

**DO:** Show Window 1, signed in as the owner.

**SAY:**
> "Hi, I'm Vinayaka. This is **Ajaia Docs**, a lightweight document editor inspired by Google Docs. It's built with React, TypeScript and the Tiptap editor, with Supabase for authentication and the Postgres database, and it's deployed on Vercel. I'll show creating and formatting documents, importing files, and sharing with real permissions, and then briefly explain how it's built and tested."

---

## 2. Create, rename and autosave · 0:20–0:50

**DO:** Click **New document**. Click the title and rename it to **`Launch Plan`**.

**SAY:**
> "I'll create a new document and rename it. Watch the status at the top right: it goes from *Unsaved changes* to *Saving* to **Saved**. It only says Saved once the database has confirmed the write, so the status is always truthful."

---

## 3. Formatting · 0:50–1:30

**DO:**
1. Click **H1** and type `Launch Plan`, then press Enter.
2. Click **H2** and type `Goals`, then press Enter.
3. Type a sentence. Select one word and press **⌘B**. Select another and click **I**, then **U**.
4. Click the **bulleted list** button and add two items. Then try the **numbered list**.
5. Select a word, click **+** on the font size control a few times, or type **24** and press Enter.
6. Press **⌘Z** (undo) and then **⌘⇧Z** (redo).

**SAY:**
> "The toolbar has headings, bold, italic, underline, bulleted and numbered lists, and font size in points, like Google Docs. Keyboard shortcuts work too, and the buttons highlight to show the current formatting. Undo and redo work as expected."

---

## 4. A4 pages and refresh · 1:30–1:55

**DO:**
1. Scroll down a little and point at the page layout. If your document is long enough, show the **grey gap between pages**.
2. Press **⌘R** to refresh the page.

**SAY:**
> "Documents are laid out on A4 pages. When content reaches the bottom of a page, it moves to the next one, and printing breaks at the same places. Now I'll refresh the page… The same document reopens with all the formatting intact, because content is saved as structured JSON in Postgres, not as HTML."

---

## 5. File menu · 1:55–2:10

**DO:** Click **File**. Point at the options, then press **Esc**.

**SAY:**
> "The File menu lets you download the document as Markdown, plain text or HTML, print or save it as an A4 PDF, or make a copy, which works like *Save as*."

---

## 6. Import a file · 2:10–2:35

**DO:**
1. Click **Upload document** and choose **`Team Plan.md`**.
2. Show the new document with its heading and lists.
3. Click **Upload document** again and choose the **`.pdf`**. Point at the red error.

**SAY:**
> "I can import text and Markdown files. The supported formats are listed right under the button. The file name becomes the title, and Markdown headings, lists and bold text become real formatting. Files are converted directly into editor content, never treated as HTML, so an uploaded file can't inject code. Unsupported files like this PDF are rejected with a clear message."

---

## 7. Share as Viewer · 2:35–3:10

**DO:**
1. Open **Launch Plan** and click **Share**.
2. Type `vinayakagcviewer@gmail.com`, keep **Viewer**, and click **Share**.
3. Switch to **Window 2** (incognito) and sign in as the viewer.
4. Point at **Shared with Me**, then open **Launch Plan**.

**SAY:**
> "Now I'll share this document with a second registered user as a **Viewer**. In a separate private window, I'm signed in as that user. The document appears under *Shared with Me*, along with who shared it. As a viewer it's **view only**: there's no toolbar, and no Share or Delete button."

---

## 8. Upgrade to Editor · 3:10–3:35

**DO:**
1. In **Window 1**, open **Share** and change the viewer's access to **Editor**. Click **Done**.
2. In **Window 2**, refresh the page. Type a line, for example `Added by the editor`, and wait for **Saved**.
3. In **Window 1**, refresh. The new line is there.

**SAY:**
> "Back as the owner, I'll upgrade that user to **Editor**. After a refresh they can edit, and their change autosaves. They still can't share or delete, because only the owner can do that. The owner sees the change after reopening the document. To be clear, this is persistent sharing, not real-time co-editing."

---

## 9. Security is in the database · 3:35–4:05

**DO:**
1. In **Window 1**, open **Share** and click **Remove** next to the user.
2. In **Window 2**, refresh. It shows **"Document not available"**.
3. Switch to **VS Code** and show the Row Level Security policies in the migration file.

**SAY:**
> "When I remove access, the other user immediately loses the document. Importantly, permissions aren't enforced by hiding buttons. They're enforced inside Postgres with **Row Level Security**. Viewers can't edit, editors can't delete or share, and no one can change a document's owner from the browser. Even someone who guesses a document's link sees nothing."

---

## 10. Testing, AI and wrap-up · 4:05–4:40

**DO:** Optionally show `npm test` passing in the VS Code terminal, or show `SUBMISSION.md`.

**SAY:**
> "For testing, there are 70 automated tests. These include security tests that run the real database migration on Postgres and check what owners, viewers, editors and strangers can do, plus tests for autosave, import and formatting. I also ran checks against the live database and end-to-end browser tests on the deployed site with two users.
>
> I built this with **Claude Code** as my AI assistant, and I verified its work rather than trusting it. For example, I deliberately broke the security rules to prove the tests catch it. The tests also found real bugs, such as a Markdown bold-italic import bug and a duplicate-document race condition, and those were fixed.
>
> The main trade-off: if two people edit at the same time, the last save wins. With more time, I'd add conflict detection and real-time collaboration. Thanks for watching!"

---

## After recording

1. Upload to **Loom**, or to **YouTube as Unlisted**.
2. Paste the link into `WALKTHROUGH_URL.txt`, or send it to Claude to add to the submission.
3. Optional: save 3–4 screenshots from the video into `screenshots/` (see `screenshots/README.md`).
