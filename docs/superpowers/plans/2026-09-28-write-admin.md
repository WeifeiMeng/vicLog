# Vic Log Write Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-protected local `/write` admin that safely manages Markdown posts and creates path-scoped local Git commits.

**Architecture:** Convert the site from static export to a Next.js Node application. Keep authentication, post persistence, Git operations, orchestration, HTTP routes, and UI in separate focused modules; serialize mutations and roll back filesystem changes when Git fails.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Node.js filesystem/crypto/child_process APIs, gray-matter, js-yaml, Vitest.

---

## File map

- Modify `next.config.ts`, `package.json`, `.gitignore`, `README.md`, `docs/local-start-guide.md`: Node runtime and local admin setup.
- Modify `lib/content/index.ts`, `app/page.tsx`, `app/archive/page.tsx`, `app/posts/[slug]/page.tsx`, `app/rss.xml/route.ts`: runtime content refresh behavior.
- Create `lib/write/types.ts`, `errors.ts`, `config.ts`, `auth.ts`, `request.ts`, `posts.ts`, `git.ts`, `service.ts`: isolated backend units.
- Create `lib/write/*.test.ts`: security, persistence, Git isolation, conflict, and rollback tests.
- Create `app/api/write/login/route.ts`, `logout/route.ts`, `posts/route.ts`, `posts/[slug]/route.ts`: JSON API.
- Create `app/write/layout.tsx`, `login/page.tsx`, `page.tsx`, `new/page.tsx`, `[slug]/page.tsx`: guarded routes.
- Create `components/write/login-form.tsx`, `admin-shell.tsx`, `post-editor.tsx`, and CSS modules: client interactions and responsive layout.

### Task 1: Runtime configuration and content freshness

- [ ] Add a failing content test proving a newly created Markdown file is visible without rebuilding, then run `npm test -- lib/content/content.test.ts` and confirm it fails for the intended stale/static assumption.
- [ ] Remove `output: "export"` from `next.config.ts`, change `start` to `next start`, remove the unused `serve` dependency, and make public filesystem-backed routes dynamic (`export const dynamic = "force-dynamic"` where required). Remove `generateStaticParams` from the article page and change RSS from `force-static` to `force-dynamic`.
- [ ] Run `npm test -- lib/content/content.test.ts` and `npm run build`; expect both to exit 0.
- [ ] Commit only runtime-related files with `git commit -m "feat: run blog with live markdown content" -- <paths>`.

### Task 2: Article parsing and safe serialization

- [ ] Create `lib/write/posts.test.ts` first with tests for listing drafts, valid serialization, invalid slug/date/title/excerpt, version hashes, duplicate creates, stale-version updates, rename conflicts, and path traversal rejection. Run it and confirm failure because `lib/write/posts.ts` does not exist.
- [ ] Implement `lib/write/types.ts` with `EditablePost`, `PostInput`, and summary types; implement typed `WriteError` codes in `errors.ts`.
- [ ] Implement `posts.ts` using `CONTENT_ROOT`, validated kebab-case slugs, `gray-matter` with the existing safe YAML parser, SHA-256 versions, and same-directory temporary-file plus rename atomic writes. Export read/list/create/update/delete filesystem operations whose update/delete require the expected version.
- [ ] Run `npm test -- lib/write/posts.test.ts`; expect all post tests to pass.
- [ ] Commit the post-domain files and tests as `feat: add safe markdown post storage`.

### Task 3: Authentication and request security

- [ ] Create `lib/write/auth.test.ts` with tests for correct/incorrect password comparison, signed session round-trip, tampering, expiry, missing/short configuration, and login throttling. Create `lib/write/request.test.ts` for accepted same-origin requests and rejected missing/cross-origin requests. Run both and confirm expected missing-module failures.
- [ ] Implement `config.ts` for environment parsing; implement `auth.ts` with timing-safe comparisons, HMAC-SHA256 sessions, 8-hour expiry, cookie options, and a bounded in-memory failed-login limiter; implement `request.ts` for same-origin mutation checks.
- [ ] Run `npm test -- lib/write/auth.test.ts lib/write/request.test.ts`; expect 0 failures.
- [ ] Commit auth/request modules and tests as `feat: protect write admin sessions`.

### Task 4: Path-scoped Git commits and rollback orchestration

- [ ] Create `lib/write/git.test.ts` using a temporary Git repository. Stage an unrelated file and leave a second unrelated file unstaged; assert a post commit contains only the post path and preserves both unrelated states. Cover create, update, rename, and delete. Run the test and confirm it fails because the Git adapter is absent.
- [ ] Implement `git.ts` with `execFile` argument arrays and pathspec-limited `git add -- <paths>` plus `git commit --only -m <message> -- <paths>`. Capture target-path index state before mutation and restore only those target paths on failure.
- [ ] Create `lib/write/service.test.ts` for serialized mutations, validation-after-write, cache callback invocation, stale versions, and exact-byte filesystem rollback when Git commit fails. Run it and confirm the missing service failure.
- [ ] Implement `service.ts` as a promise queue around post storage and Git operations. Snapshot old/new target bytes, roll back only target files/index entries on failure, return the new version, and accept a cache invalidation callback for route handlers.
- [ ] Run `npm test -- lib/write/git.test.ts lib/write/service.test.ts`; expect 0 failures, including the unrelated-change assertions.
- [ ] Commit Git/service modules and tests as `feat: commit article changes safely`.

### Task 5: Authenticated JSON API

- [ ] Create route-level tests for login success/failure/throttle, logout, unauthenticated article reads, invalid Origin writes, CRUD response shapes, status-code mapping, and cache revalidation. Run them and confirm route imports fail.
- [ ] Add small shared response/auth helpers, then implement:
  - `POST /api/write/login`
  - `POST /api/write/logout`
  - `GET|POST /api/write/posts`
  - `GET|PUT|DELETE /api/write/posts/[slug]`
  Use `{ data }` and `{ error: { code, message } }`, validate sessions server-side, check Origin for every mutation, and call `revalidatePath` for `/`, `/archive`, both old/new article URLs, and `/rss.xml` after commits.
- [ ] Run the route tests and the complete `npm test`; expect all tests to pass.
- [ ] Commit API files/tests as `feat: add write admin API`.

### Task 6: Guarded admin pages and editor UI

- [ ] Add lightweight component tests for failed login feedback, list filtering, edit/preview switching, dirty-state warning, disabled submit while saving, and delete confirmation. Run them and confirm failure before components exist.
- [ ] Add `/write` metadata with `noindex, nofollow` and a server-side session guard that redirects unauthenticated users to `/write/login`.
- [ ] Implement `login-form.tsx` and the login page with cleared password/error handling.
- [ ] Implement `admin-shell.tsx` with search, published/draft filter, article links, new-article action, and logout.
- [ ] Implement `post-editor.tsx` with all frontmatter fields, edit/preview modes using `MarkdownContent`, responsive split preview, dirty-state protection, save/rename/delete API calls, inline status, and confirmation.
- [ ] Add the `/write`, `/write/new`, and `/write/[slug]` server pages and responsive CSS matching the approved cream/ink/brick-red layout.
- [ ] Run focused component tests and `npm test`; expect 0 failures.
- [ ] Commit UI files/tests as `feat: add write admin interface`.

### Task 7: Local setup documentation

- [ ] Add `.env.example` with placeholders only and update `.gitignore` so `.env.local` is ignored while `.env.example` remains tracked.
- [ ] Update `README.md` and `docs/local-start-guide.md` with Node version, `npm install`, environment setup, `npm run dev`, `npm run build && npm start`, `/write`, Git identity prerequisites, local-only commit behavior, and the explicit statement that deployment/push is deferred.
- [ ] Run `git diff --check` on the documentation/config files.
- [ ] Commit only admin-related documentation and `.env.example` as `docs: add local write admin guide`, preserving the user's unrelated README edits by staging only the added hunks or leaving README changes uncommitted if they cannot be safely separated.

### Task 8: End-to-end verification

- [ ] Run `npm test` and record the exact passing test/file count.
- [ ] Run `npm run build` and confirm all `/write` and API routes compile under the Node runtime.
- [ ] Start `npm run dev` with temporary non-secret test environment values and verify in a browser: unauthenticated redirect, failed/correct login, create draft, preview, publish, rename, and delete.
- [ ] Inspect each generated test article commit with `git show --stat --oneline HEAD` and verify unrelated working-tree/index changes are unchanged. Remove test content only through the admin delete flow so its deletion is also recorded.
- [ ] Run `git status --short`, compare the result with the pre-existing dirty-file inventory, and report any remaining implementation or user-owned changes separately.
- [ ] Perform a final requirements checklist against `docs/superpowers/specs/2026-09-28-write-admin-design.md` before claiming completion.
