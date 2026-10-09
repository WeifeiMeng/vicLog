# Vic Log Post Authors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required, freely extensible article author field that is editable in `/write` and visible on the home, archive, and article-detail pages.

**Architecture:** Extend the existing `Post` and `PostInput` contracts with a non-empty `author` string, then let the current content loader and write store carry that field through Markdown frontmatter. Reuse existing metadata rows for public display and use an HTML `datalist` in the write editor so `Vic` and `Vic Agent` are suggested without restricting custom names.

**Tech Stack:** Next.js App Router, React 19, TypeScript, gray-matter, js-yaml, CSS Modules, Vitest, React server rendering tests

---

## File map

- `lib/content/types.ts`: public article contract.
- `lib/content/validate.ts`: required author validation shared by public and write paths.
- `lib/content/content.test.ts`: content parsing and validation coverage.
- `lib/write/types.ts`: write API and editor article contract.
- `lib/write/posts.ts`: write validation, Markdown serialization, and parsing.
- `lib/write/posts.test.ts`: write-store author round-trip and custom-author coverage.
- `lib/write/service.test.ts`: fixture compatibility with the expanded contract.
- `app/write/(admin)/new/page.tsx`: new-post default author.
- `components/write/post-editor.tsx`: author input with suggestions and state preservation.
- `components/write/post-editor.test.tsx`: server-rendered editor control coverage.
- `components/post-card.tsx`: home-page author rendering.
- `components/post-card.test.tsx`: home card author assertion.
- `app/archive/page.tsx`: archive author rendering.
- `app/archive/page.test.tsx`: archive page author integration.
- `app/posts/[slug]/page.tsx`: article-detail author rendering.
- `app/posts/[slug]/page.test.tsx`: article-detail author integration.
- `components/post-meta.tsx`: shared, directly testable author label used by archive and detail pages.
- `components/post-meta.test.tsx`: shared label behavior coverage.
- `components/post-card.module.css`, `app/archive/page.module.css`, `app/posts/[slug]/page.module.css`: metadata separator/layout styling.
- `content/posts/*.md`: one-time `author: Vic` migration; preserve all other bytes as far as the one-line insertion allows.

### Task 1: Extend the public content contract and migrate Markdown

**Files:**
- Modify: `lib/content/types.ts`
- Modify: `lib/content/validate.ts`
- Modify: `lib/content/content.test.ts`
- Modify: `content/posts/build-useful-tools.md`
- Modify: `content/posts/clear-complex-systems.md`
- Modify: `content/posts/cordis-paper-summary.md`
- Modify: `content/posts/deepseek-harness-context-compress.md`
- Modify: `content/posts/think-further.md`
- Modify without staging: `content/posts/dsh-system-prompt-assembly.md`

- [ ] **Step 1: Write failing content tests**

Add `author: Vic` to the valid `writePost` fixture strings and assert that it is loaded. Add focused validation cases:

```ts
test("loads the required article author", async () => {
  const root = await createContentRoot();
  await writePost(
    root,
    "by-agent.md",
    "title: Agent note\nauthor: Vic Agent\ndate: 2026-01-02\nexcerpt: Note\npublished: true",
  );

  expect(loadContent(root).posts[0].author).toBe("Vic Agent");
});

test.each([undefined, "", "   ", 42])("rejects invalid article author %j", (author) => {
  expect(() =>
    validatePost(
      {
        title: "Note",
        author,
        date: "2026-01-02",
        excerpt: "Excerpt",
        published: true,
      },
      "note.md",
    ),
  ).toThrow(/invalid or missing author/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- lib/content/content.test.ts`

Expected: FAIL because `Post` has no `author` contract and `validatePost` does not return or reject the field.

- [ ] **Step 3: Implement required author validation**

Add `author: string` after `title` in `Post`, then add this validation and returned field in `validatePost`:

```ts
if (typeof data.author !== "string" || data.author.trim() === "") {
  throw new Error(`${file}: invalid or missing author`);
}

return {
  title: data.title,
  author: data.author.trim(),
  // existing fields remain unchanged
};
```

- [ ] **Step 4: Migrate all current Markdown files narrowly**

First preserve a comparison copy of the untracked article:

```bash
cp content/posts/dsh-system-prompt-assembly.md /tmp/viclog-dsh-before-20261009.md
```

Insert `author: Vic` immediately after each `title:` line. Do not reserialize frontmatter or change body text. Apply the same one-line insertion to the untracked `content/posts/dsh-system-prompt-assembly.md`, but do not stage or commit that user-owned untracked file.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `npm test -- lib/content/content.test.ts`

Expected: all content tests PASS.

- [ ] **Step 6: Commit only the contract, tests, and tracked article migrations**

```bash
git add lib/content/types.ts lib/content/validate.ts lib/content/content.test.ts \
  content/posts/build-useful-tools.md content/posts/clear-complex-systems.md \
  content/posts/cordis-paper-summary.md content/posts/deepseek-harness-context-compress.md \
  content/posts/think-further.md
git commit -m "feat: require article authors"
```

Before committing, verify `git status --short` still shows `?? content/posts/dsh-system-prompt-assembly.md` rather than staging it.

### Task 2: Preserve authors through the write store

**Files:**
- Modify: `lib/write/types.ts`
- Modify: `lib/write/posts.ts`
- Modify: `lib/write/posts.test.ts`
- Modify: `lib/write/service.test.ts`
- Modify: `lib/write/admin-state.test.ts`

- [ ] **Step 1: Write failing write-store tests**

Add `author: "Vic"` to shared post fixtures and add these assertions:

```ts
test("requires a non-empty author", () => {
  expect(() => validatePostInput({ ...draft, author: " " })).toThrow(/author/i);
});

test("round-trips a custom author through Markdown", async () => {
  const root = await makeRoot();
  const store = createPostStore(root);
  const custom = { ...draft, author: "Guest Writer" };

  await writeFile(path.join(root, "posts", "hello-world.md"), serializePost(custom));

  expect(await store.read("hello-world")).toMatchObject(custom);
  expect(await readFile(path.join(root, "posts", "hello-world.md"), "utf8"))
    .toContain("author: Guest Writer");
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- lib/write/posts.test.ts lib/write/service.test.ts lib/write/admin-state.test.ts`

Expected: FAIL because `PostInput` and write serialization do not include `author`.

- [ ] **Step 3: Implement the write contract and round trip**

Add `author: string` to `PostInput`. In `validatePostInput`, pass `author: input.author.trim()` into `validatePost`, and return `author: validated.author`. In `serializePost`, emit it after `title`:

```ts
const frontmatter = dumpYaml(
  {
    title: input.title,
    author: input.author,
    date: input.date,
    ...(input.category ? { category: input.category } : {}),
    excerpt: input.excerpt,
    published: input.published,
  },
  { schema: JSON_SCHEMA, lineWidth: -1, noRefs: true },
).trimEnd();
```

Return `author: data.author` from `read`, and use `author: "Vic"` in the internal `pathFor` validation object. Update all test fixtures that construct `PostInput` or `PostSummary` to include an author.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- lib/write/posts.test.ts lib/write/service.test.ts lib/write/admin-state.test.ts`

Expected: all selected write tests PASS.

- [ ] **Step 5: Commit the write data path**

```bash
git add lib/write/types.ts lib/write/posts.ts lib/write/posts.test.ts \
  lib/write/service.test.ts lib/write/admin-state.test.ts
git commit -m "feat: persist post authors in write API"
```

### Task 3: Add the author editor with suggestions

**Files:**
- Modify: `app/write/(admin)/new/page.tsx`
- Modify: `components/write/post-editor.tsx`
- Create: `components/write/post-editor.test.tsx`

- [ ] **Step 1: Write a failing editor rendering test**

Create a server-rendering test that proves the control is required, keeps a custom value, and exposes both suggestions:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { PostEditor } from "./post-editor";

test("renders a required author input with common author suggestions", () => {
  const markup = renderToStaticMarkup(
    <PostEditor
      initial={{
        slug: "guest-note",
        title: "Guest note",
        author: "Guest Writer",
        date: "2026-10-09",
        category: "",
        excerpt: "Excerpt",
        published: false,
        body: "",
      }}
    />,
  );

  expect(markup).toContain('name="author"');
  expect(markup).toContain('value="Guest Writer"');
  expect(markup).toContain('value="Vic"');
  expect(markup).toContain('value="Vic Agent"');
  expect(markup).toContain("required");
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run: `npm test -- components/write/post-editor.test.tsx`

Expected: FAIL because the author control and suggestions are absent.

- [ ] **Step 3: Add the default and editable author input**

Set `author: "Vic"` in the new-post input. Add this field near date/category in `PostEditor`:

```tsx
<label>
  <span>作者</span>
  <input
    list="post-author-suggestions"
    name="author"
    onChange={(event) => set("author", event.target.value)}
    required
    value={form.author}
  />
  <datalist id="post-author-suggestions">
    <option value="Vic" />
    <option value="Vic Agent" />
  </datalist>
</label>
```

Include `author` in `stripVersion` so editor state and requests preserve it:

```ts
const { slug, title, author, date, category, excerpt, published, body } = post;
return { slug, title, author, date, category, excerpt, published, body };
```

- [ ] **Step 4: Run the component test and verify GREEN**

Run: `npm test -- components/write/post-editor.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the editor change**

```bash
git add 'app/write/(admin)/new/page.tsx' components/write/post-editor.tsx \
  components/write/post-editor.test.tsx
git commit -m "feat: edit post authors in write console"
```

### Task 4: Render authors on every requested public page

**Files:**
- Create: `components/post-meta.tsx`
- Create: `components/post-meta.test.tsx`
- Modify: `components/post-card.tsx`
- Modify: `components/post-card.test.tsx`
- Modify: `components/post-card.module.css`
- Modify: `app/archive/page.tsx`
- Create: `app/archive/page.test.tsx`
- Modify: `app/archive/page.module.css`
- Modify: `app/posts/[slug]/page.tsx`
- Create: `app/posts/[slug]/page.test.tsx`
- Modify: `app/posts/[slug]/page.module.css`

- [ ] **Step 1: Write failing public rendering tests**

Add `author: "Vic Agent"` to the `PostCard` fixture and assert `作者 · Vic Agent`. Create the shared metadata test:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { PostAuthor } from "./post-meta";

test("renders an explicit article author label", () => {
  expect(renderToStaticMarkup(<PostAuthor author="Vic Agent" />)).toContain(
    "作者 · Vic Agent",
  );
});
```

Add an archive-page integration test with a mocked post:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/content", () => ({
  getPosts: () => [{
    slug: "agent-note",
    title: "Agent note",
    author: "Vic Agent",
    date: "2026-10-09",
    excerpt: "Excerpt",
    published: true,
    body: "",
  }],
  groupPostsByYear: (posts: unknown[]) => [{ year: "2026", posts }],
}));

import ArchivePage from "./page";

test("renders authors in the archive list", () => {
  expect(renderToStaticMarkup(<ArchivePage />)).toContain("作者 · Vic Agent");
});
```

Add a detail-page integration test, mocking the content module and awaiting the async page component:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const post = {
  slug: "agent-note",
  title: "Agent note",
  author: "Vic Agent",
  date: "2026-10-09",
  excerpt: "Excerpt",
  published: true,
  body: "Body",
};

vi.mock("@/lib/content", () => ({
  getPost: () => post,
  getPosts: () => [post],
  getAdjacentPosts: () => ({}),
}));

import PostPage from "./page";

test("renders the author in the article header", async () => {
  const page = await PostPage({ params: Promise.resolve({ slug: "agent-note" }) });
  expect(renderToStaticMarkup(page)).toContain("作者 · Vic Agent");
});
```

- [ ] **Step 2: Run the public component tests and verify RED**

Run: `npm test -- components/post-card.test.tsx components/post-meta.test.tsx app/archive/page.test.tsx 'app/posts/[slug]/page.test.tsx'`

Expected: FAIL because `PostAuthor` and visible author output do not exist.

- [ ] **Step 3: Implement the shared label and home card output**

Create the small shared component:

```tsx
export function PostAuthor({ author }: { author: string }) {
  return <span>作者 · {author}</span>;
}
```

Render `<PostAuthor author={post.author} />` in the `PostCard` metadata after category. Replace the category-only separator selector with a sibling separator so both category and author receive the same separator:

```css
.meta > * + *::before {
  content: "·";
  margin-right: 0.65rem;
}
```

- [ ] **Step 4: Render the shared label in archive and detail pages**

Import `PostAuthor` in both pages. Keep the archive's third grid column as a metadata group:

```tsx
<span className={styles.details}>
  {post.category ? <span>{post.category}</span> : null}
  <PostAuthor author={post.author} />
</span>
```

Give that group an inline, wrapping layout and add a separator between its children:

```css
.details {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-end;
}

.details > * + *::before {
  content: "·";
  margin-right: 0.45rem;
}
```

In the article detail metadata row, render `<PostAuthor author={post.author} />` after the optional category. The existing `.meta span::before` rule will place the row separator before both category and author while the component retains the explicit `作者 · 名称` label.

- [ ] **Step 5: Run public component tests and verify GREEN**

Run: `npm test -- components/post-card.test.tsx components/post-meta.test.tsx app/archive/page.test.tsx 'app/posts/[slug]/page.test.tsx'`

Expected: PASS.

- [ ] **Step 6: Commit public author rendering**

```bash
git add components/post-meta.tsx components/post-meta.test.tsx \
  components/post-card.tsx components/post-card.test.tsx components/post-card.module.css \
  app/archive/page.tsx app/archive/page.test.tsx app/archive/page.module.css \
  'app/posts/[slug]/page.tsx' 'app/posts/[slug]/page.test.tsx' \
  'app/posts/[slug]/page.module.css'
git commit -m "feat: show authors on public post pages"
```

### Task 5: Full verification and scope audit

**Files:**
- Verify only; modify earlier files only if a test or type check exposes a defect.

- [ ] **Step 1: Verify every article has exactly one author field**

Run:

```bash
for file in content/posts/*.md; do
  count=$(rg -c '^author: ' "$file")
  test "$count" = "1" || { echo "$file has $count author fields"; exit 1; }
done
```

Expected: exit 0 with no output.

- [ ] **Step 2: Run the full automated test suite**

Run: `npm test`

Expected: all test files and tests PASS with no unhandled errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully, including `/`, `/archive`, `/posts/[slug]`, and `/write` routes.

- [ ] **Step 4: Audit the final diff and untracked-file boundary**

Run:

```bash
git diff --check
git status --short
diff -u /tmp/viclog-dsh-before-20261009.md content/posts/dsh-system-prompt-assembly.md
```

Expected: no whitespace errors; the untracked article remains untracked; the final `diff` shows exactly one added `author: Vic` line and no other change; no unrelated user files are staged. (`diff` exits 1 when it correctly finds that one-line difference.)

- [ ] **Step 5: Commit any verification-only fixes, if needed**

If verification required code corrections, stage only those named files and commit:

```bash
git commit -m "fix: complete post author integration"
```

If no correction was needed, do not create an empty commit.
