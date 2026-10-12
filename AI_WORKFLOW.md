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

## How correctness was checked

- `npm test` runs 54 tests in 8 files (see SUBMISSION.md for the latest run). These include 15 RLS tests on real Postgres (PGlite), 5 autosave race tests with fake timers, import validation and conversion tests, rich-text round-trips through a real headless Tiptap editor, and React component tests.
- `npm run typecheck`, `npm run lint` and `npm run build` were run after each major change.
- The dev server was started and checked with HTTP requests. No browser automation was available in this environment.
- Mocked tests are labelled as such in the code. They are not presented as proof of database security; the PGlite and live tests serve that role.

## Remaining uncertainty

- The PGlite tests use an emulated `auth` schema and emulated default grants. The same rules were then confirmed on the hosted Supabase project with `npm run test:live` (10/10 checks passed).
- The UI has been verified through component tests and a build. A full manual pass in a real browser against the deployed app is still needed. SUBMISSION.md records whether it has been done.
