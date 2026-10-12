# AI Workflow

This file records how AI was actually used to build this project. It was written from the real session history, not in advance.

## Tools used

- **Claude Code** (Anthropic, model Claude Opus 5.5) in the VS Code extension, as a single agent session.
- The AI inspected the workspace, wrote the code and tests, ran shell commands (npm, Vitest, ESLint, `tsc`, Vite, git), read the failures and fixed them.
- The human author wrote the detailed requirements prompt. They are responsible for the remaining external steps: Supabase project, Vercel, reviewer accounts, the walkthrough recording and final review.

No other AI tools were used.

## What AI sped up

- Scaffolding the Vite, TypeScript, Tailwind, ESLint and Vitest configuration.
- Drafting the SQL migration: schema, column grants, RLS policies, `SECURITY DEFINER` helpers and the `share_document` RPC.
- Building a way to test RLS on real Postgres without Docker or the Supabase CLI. Neither was installed. The AI chose PGlite and wrote a small Supabase `auth` shim.
- The React UI, the autosave controller, the Markdown → Tiptap JSON converter, and the unit and component tests.
- Documentation.

## Verification, and what changed because of it

Every item below happened during this session.

1. **Checking the environment before building.**
   - The workspace sits on an exFAT volume. The AI probed `npm install` and confirmed that symlinks work but that macOS writes `._*` AppleDouble files. Those files are excluded in `.gitignore`, the Vitest `include`/`exclude`, ESLint ignores and the tsconfig excludes.
   - The latest TypeScript (7.x) is outside typescript-eslint's supported range (`<6.1.0`), so TypeScript was pinned to `~5.9.3` rather than accepting the newest version.
2. **Mutation-testing the RLS tests.** The 15 RLS tests passed on their first run, which on its own proves little. The migration was weakened three times and the tests re-run each time:
   - viewers allowed to update: 2 tests failed;
   - `SELECT` policy changed to `using (true)`: 3 tests failed;
   - the column-level `UPDATE` grant removed: 2 tests failed.

   The third case also showed that the `owner_id` trigger still blocked ownership changes once the grant was gone. That confirmed the second layer of defence works. The original migration was restored and re-verified (15/15).
3. **An RLS behaviour that would have produced a false "Saved".** When RLS rejects an `UPDATE`, it matches zero rows instead of raising an error. A naive client would report success. `updateDocument`, `deleteDocument` and the share mutations now request the affected rows and throw `AccessLostError` when the count is wrong. A unit test covers this.
4. **Bugs found by tests and tools, then fixed:**
   - The first rich-text round-trip test chained Tiptap commands in an invalid way (`RangeError: Position 20 out of range`). This was a bug in the test. It was rewritten to select text ranges and apply the same commands as the toolbar.
   - ESLint flagged `no-irregular-whitespace`. Inspecting the bytes with `od -c` showed that a literal U+FEFF (BOM) character had been written into a regex where the `﻿` escape was intended. It was fixed, and the source tree was scanned for other stray BOM or NUL characters.
   - Component tests leaked DOM between tests, because RTL's auto-cleanup needs Vitest globals, which are off. Explicit `cleanup()` was added to the setup file.
   - jsdom has no `getClientRects`, which ProseMirror calls on focus. Layout polyfills were added, and then guarded because the same setup file also runs in the Node environment used by the PGlite tests.
   - A react-refresh lint error led to moving `filterDocuments` out of a component file.
5. **Design choices made for robustness:**
   - The autosave controller is created inside `useEffect` rather than lazily in state. With React StrictMode's mount → unmount → mount sequence, a lazily created controller would have been disposed and silenced permanently in development.
   - The Markdown importer builds Tiptap JSON directly instead of converting Markdown to HTML and parsing it. A test confirms that `<img src=x onerror=...>` in an uploaded file stays literal text.
6. **A correction to the documentation.** An early README draft said other users see changes "after refocusing the window". That was inaccurate: focus refreshes only the document lists. The sentence was corrected.

7. **The live check against hosted Supabase found a bug in a test.** The first `npm run test:live` run passed 9 of 10 checks. The formatted-content round-trip failed. Before changing anything, a one-off probe compared the sent and received JSON. Postgres `jsonb` had returned the keys in a different order (`{"text","type",...}` instead of `{"type","text",...}`), but `isDeepStrictEqual` was `true`. No data was lost. The check had compared `JSON.stringify` output, which depends on key order. It now compares structurally, and the re-run passed 10/10. The PGlite test had used deep equality from the start, which is why it never showed the problem.

8. **Follow-up request: A4 pages, download, print and "save as".**
   - Before building, the AI told the user that Google Docs-style pagination is not something Tiptap provides, and proposed A4 page markers plus real A4 printing instead.
   - The new export-then-import round-trip test found a **real importer bug**: `***bold italic***` was imported as bold `*text` followed by a stray `*`. This would also have affected users' own Markdown files. The importer was fixed rather than working around it in the exporter.
   - Adding two capture groups to the importer's inline pattern shifted the bold rule's back-reference (`\1` → `\3`, and later `\4`). This was caught by re-reading the change before running the tests.
   - The first exporter draft escaped numbered lines as `\1.`, which is not valid Markdown escaping (it should be `1\.`), and indented nested lists twice. Both were caught by reviewing the code and fixed before testing.
   - **Real-browser check.** Headless Chrome (puppeteer-core, run from a scratch directory and not added as a project dependency) signed in to the live Supabase project, wrote a document longer than one page, opened the File menu, printed to PDF and made a copy.
     - It confirmed the A4 sheet width, the A4 PDF paper size, that the copy contained all the content, that content persisted after a reload, that there was no horizontal overflow at 390 px, and that there were no console errors.
     - It also showed a **mismatch**: 3 pages on screen but 4 printed. Inspecting the PDF text page by page with PDFKit showed that print fits 13 paragraphs per page, because it avoids splitting short paragraphs. Rather than claim exact pagination, the markers are now documented and labelled as approximate.
     - The script's own title edit failed (triple-click didn't select the title), which produced the title "Untitled documentBrowser check…". This was a script problem, not an app bug, and the test documents were deleted through the app's own delete flow.

9. **A wrong bundle-size figure in the docs.** After the File menu was added, the build appeared to grow from 184 kB to 263 kB gzipped. Before attributing that to the new code, the AI built the previous commit in a separate git worktree and listed the bundle's modules from the sourcemap. It then rebuilt the current code with the Supabase environment variables blanked.
   - The cause: the earlier builds had run before `.env.local` existed. `isSupabaseConfigured` was therefore a constant `false`, and the bundler dropped supabase-js as dead code.
   - The new features added almost nothing (580.28 kB in both builds without Supabase settings). The earlier "184 kB" figure did not represent a real deployment, and it was corrected to 263 kB gzipped everywhere it appeared.

10. **Follow-up request: real page gaps and a font size control.**
    - The user pointed out that the dashed markers had no real gap: text ran straight across the page boundary. The overlay was replaced with block-level pagination, using measured spacer decorations, with the page-break logic as a pure, unit-tested function. The remaining limit was stated up front: paragraphs move to the next page whole rather than splitting line by line.
    - A component test failed at the font-size step. Stack traces showed a real race. Tiptap's `focus()` runs on a **timer**, so clicking `+` and then quickly typing in the size box let that delayed focus pull the cursor out of the box mid-number (it produced 6 pt instead of 30). The `+`/`–` buttons no longer call `focus()`; they don't need to, because they already preserve the editor's selection.
    - An earlier version of that test asserted the wrong thing: that a pending size with no text selected survives switching to H1. It doesn't, and shouldn't. The assertion was corrected to the real behaviour.
    - The headless-Chrome run found **a real bug unrelated to the new features**: React warned about duplicate keys in the sidebar. A window-focus list refresh could finish while "New document" was saving and already include the new row, and the create handler then added it again. Adding a document now de-duplicates by id. A regression test reproduces the race, and it was confirmed to fail without the fix.
    - The first screenshot after the visual fix still looked wrong. The cause was **not** the code: the Vite dev server was serving a stale copy of `paginationExtension.ts`. That file had been created after the server started, and on this exFAT drive the file watcher did not pick up its later edits. This was confirmed by fetching the module from the dev server and comparing it with the file on disk. Restarting the server fixed it.
    - The script's own title edits had failed twice, because headless Chrome on macOS ignores ⌘A. The script now selects the field's text directly, and the title came out correctly.

## How correctness was checked

- `npm test` runs all automated tests (see SUBMISSION.md for the latest run). These include 15 RLS tests on real Postgres (PGlite), 5 autosave race tests with fake timers, import validation and conversion tests, rich-text round-trips through a real headless Tiptap editor, and React component tests.
- `npm run typecheck`, `npm run lint` and `npm run build` were run after each major change.
- The dev server was started and checked with HTTP requests. No browser automation was available in this environment.
- Mocked tests are labelled as such in the code. They are not presented as proof of database security; the PGlite and live tests serve that role.

## Remaining uncertainty

- The PGlite tests use an emulated `auth` schema and emulated default grants. The same rules were then confirmed on the hosted Supabase project with `npm run test:live` (10/10 checks passed).
- The UI has been verified through component tests and a build. A full manual pass in a real browser against the deployed app is still needed. SUBMISSION.md records whether it has been done.
