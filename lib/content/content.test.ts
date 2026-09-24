import {
  chmod,
  mkdtemp,
  mkdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  assertUniqueSlugs,
  getAdjacentPosts,
  getPost,
  getPosts,
  getSite,
  groupPostsByYear,
  loadContent,
} from "./index";
import type { Post } from "./types";
import { validatePost, validateSite } from "./validate";

const temporaryRoots: string[] = [];
const originalCwd = process.cwd();

async function createContentRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "vic-log-content-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "posts"));
  await writeFile(
    path.join(root, "site.md"),
    "---\nname: Vic Log\nauthor: Vic\ntagline: Notes\n---\nAbout Vic.\n",
  );
  return root;
}

async function writePost(
  root: string,
  filename: string,
  frontmatter: string,
  body = "Post body.\n",
): Promise<void> {
  await writeFile(
    path.join(root, "posts", filename),
    `---\n${frontmatter}\n---\n${body}`,
  );
}

afterEach(async () => {
  process.chdir(originalCwd);
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("loadContent", () => {
  test("filters unpublished posts and sorts published posts newest-first", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "older.md",
      'title: Older\ndate: "2026-01-02"\nexcerpt: Older excerpt\npublished: true',
    );
    await writePost(
      root,
      "newer.md",
      'title: Newer\ndate: "2026-03-04"\nexcerpt: Newer excerpt\npublished: true',
    );
    await writePost(
      root,
      "draft.md",
      'title: Draft\ndate: "2026-04-05"\nexcerpt: Draft excerpt\npublished: false',
    );
    await writePost(
      root,
      "ignored.txt",
      'title: Ignored\ndate: "2027-01-01"\nexcerpt: Ignored excerpt\npublished: true',
    );

    const content = loadContent(root);

    expect(content.site).toMatchObject({
      name: "Vic Log",
      author: "Vic",
      body: "About Vic.\n",
    });
    expect(content.posts.map((post) => post.slug)).toEqual(["newer", "older"]);
  });

  test("reports the filename and invalid field for a malformed post", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "broken.md",
      'date: "2026-03-04"\nexcerpt: Broken excerpt\npublished: true',
    );

    expect(() => loadContent(root)).toThrow(/broken\.md: invalid or missing title/);
  });

  test("rejects a post filename that cannot be used as a URL-safe slug", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "notes#draft.md",
      'title: Unsafe slug\ndate: "2026-03-04"\nexcerpt: Unsafe slug\npublished: true',
    );

    expect(() => loadContent(root)).toThrow(
      /notes#draft\.md: invalid post slug "notes#draft"/,
    );
  });

  test("reports a useful file-aware error when site.md is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "vic-log-content-"));
    temporaryRoots.push(root);
    await mkdir(path.join(root, "posts"));

    expect(() => loadContent(root)).toThrow(/site\.md: missing site content/);
  });

  test("rejects an impossible calendar date", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "impossible.md",
      "title: Impossible\ndate: 2026-02-30\nexcerpt: Impossible date\npublished: true",
    );

    expect(() => loadContent(root)).toThrow(/impossible\.md: invalid or missing date/);
  });

  test("normalizes an unquoted YAML date to a YYYY-MM-DD string", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "unquoted.md",
      "title: Unquoted\ndate: 2026-01-02\nexcerpt: Unquoted date\npublished: true",
    );

    const [post] = loadContent(root).posts;

    expect(post.date).toBe("2026-01-02");
    expect(typeof post.date).toBe("string");
  });

  test("does not treat date text inside a multiline quoted scalar as frontmatter", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "quoted-scalar.md",
      'title: Quoted scalar\nexcerpt: "First line\ndate: 2099-12-31\nlast line"\ndate: 2026-01-02\npublished: true',
    );

    const [post] = loadContent(root).posts;

    expect(post.date).toBe("2026-01-02");
    expect(post.excerpt).toContain("date: 2099-12-31");
  });

  test("does not synthesize a missing date from a multiline quoted scalar", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "missing-date.md",
      'title: Missing date\nexcerpt: "First line\ndate: 2099-12-31\nlast line"\npublished: true',
    );

    expect(() => loadContent(root)).toThrow(
      /missing-date\.md: invalid or missing date/,
    );
  });

  test("validates site frontmatter with its filename", async () => {
    const root = await createContentRoot();
    await writeFile(path.join(root, "site.md"), "---\nname: Vic Log\ntagline: Notes\n---\n");

    expect(() => loadContent(root)).toThrow(/site\.md: invalid or missing author/);
  });

  test("wraps malformed site YAML with the file path and original cause", async () => {
    const root = await createContentRoot();
    const siteFile = path.join(root, "site.md");
    await writeFile(siteFile, "---\nname: [broken\n---\n");

    let thrown: unknown;
    try {
      loadContent(root);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(siteFile);
    expect((thrown as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
  });

  test("does not mislabel file read failures as invalid YAML", async () => {
    const root = await createContentRoot();
    const siteFile = path.join(root, "site.md");
    await chmod(siteFile, 0o000);

    let thrown: unknown;
    try {
      loadContent(root);
    } catch (error) {
      thrown = error;
    } finally {
      await chmod(siteFile, 0o644);
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as NodeJS.ErrnoException).code).toBe("EACCES");
    expect((thrown as Error).message).not.toContain("invalid YAML");
  });

  test("wraps malformed post YAML with the file path and original cause", async () => {
    const root = await createContentRoot();
    const postFile = path.join(root, "posts", "malformed.md");
    await writeFile(postFile, "---\ntitle: [broken\n---\n");

    let thrown: unknown;
    try {
      loadContent(root);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(postFile);
    expect((thrown as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
  });

  test("uses descending slug order as a deterministic same-date tie-breaker", async () => {
    const root = await createContentRoot();
    for (const slug of ["alpha", "zulu"]) {
      await writePost(
        root,
        `${slug}.md`,
        `title: ${slug}\ndate: 2026-01-02\nexcerpt: ${slug}\npublished: true`,
      );
    }

    expect(loadContent(root).posts.map(({ slug }) => slug)).toEqual([
      "zulu",
      "alpha",
    ]);
  });
});

describe("groupPostsByYear", () => {
  test("returns year groups in descending order", () => {
    const posts = [
      { slug: "old", date: "2024-08-01" },
      { slug: "new", date: "2026-01-02" },
      { slug: "middle", date: "2025-03-04" },
      { slug: "newer", date: "2026-07-08" },
    ] as Post[];

    const groups = groupPostsByYear(posts);

    expect(groups.map(({ year }) => year)).toEqual(["2026", "2025", "2024"]);
    expect(groups[0].posts.map(({ slug }) => slug)).toEqual(["new", "newer"]);
  });
});

describe("assertUniqueSlugs", () => {
  test("rejects two in-memory posts that share a slug", () => {
    const posts = [
      { slug: "duplicate", title: "First" },
      { slug: "duplicate", title: "Second" },
    ] as Post[];

    expect(() => assertUniqueSlugs(posts)).toThrow(/duplicate slug: duplicate/);
  });
});

describe("default content accessors", () => {
  test("return the default site's published posts and find a post by slug", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "vic-log-workspace-"));
    temporaryRoots.push(workspace);
    const root = path.join(workspace, "content");
    await mkdir(path.join(root, "posts"), { recursive: true });
    await writeFile(
      path.join(root, "site.md"),
      "---\nname: Default Site\nauthor: Vic\ntagline: ''\n---\nSite body.\n",
    );
    await writePost(
      root,
      "hello.md",
      'title: Hello\ndate: "2026-01-02"\nexcerpt: Hello excerpt\npublished: true',
    );
    process.chdir(workspace);

    expect(getSite().name).toBe("Default Site");
    expect(getPosts().map(({ slug }) => slug)).toEqual(["hello"]);
    expect(getPost("hello")?.title).toBe("Hello");
    expect(getPost("missing")).toBeUndefined();
  });

  test("navigates previous to older and next to newer in the descending list", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "vic-log-workspace-"));
    temporaryRoots.push(workspace);
    const root = path.join(workspace, "content");
    await mkdir(path.join(root, "posts"), { recursive: true });
    await writeFile(
      path.join(root, "site.md"),
      "---\nname: Default Site\nauthor: Vic\ntagline: ''\n---\n",
    );
    for (const [slug, date] of [
      ["newest", "2026-03-01"],
      ["middle", "2026-02-01"],
      ["oldest", "2026-01-01"],
    ]) {
      await writePost(
        root,
        `${slug}.md`,
        `title: ${slug}\ndate: "${date}"\nexcerpt: ${slug}\npublished: true`,
      );
    }
    process.chdir(workspace);

    expect(getAdjacentPosts("middle")).toMatchObject({
      previous: { slug: "oldest" },
      next: { slug: "newest" },
    });
    expect(getAdjacentPosts("newest")).toEqual({
      previous: expect.objectContaining({ slug: "middle" }),
    });
    expect(getAdjacentPosts("oldest")).toEqual({
      next: expect.objectContaining({ slug: "middle" }),
    });
    expect(getAdjacentPosts("missing")).toEqual({});
  });
});

describe("content caching", () => {
  test("caches unchanged default-root reads and invalidates when a file changes", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "vic-log-workspace-"));
    temporaryRoots.push(workspace);
    const root = path.join(workspace, "content");
    await mkdir(path.join(root, "posts"), { recursive: true });
    await writeFile(
      path.join(root, "site.md"),
      "---\nname: Cached Site\nauthor: Vic\ntagline: ''\n---\n",
    );
    await writePost(
      root,
      "cached.md",
      "title: Before\ndate: 2026-01-02\nexcerpt: Before\npublished: true",
    );
    process.chdir(workspace);

    const first = loadContent();
    const unchanged = loadContent();
    expect(unchanged).toBe(first);

    const postFile = path.join(root, "posts", "cached.md");
    const initialSize = (await stat(postFile)).size;
    await writePost(
      root,
      "cached.md",
      "title: After!\ndate: 2026-01-02\nexcerpt: After!\npublished: true",
    );
    const later = new Date(Date.now() + 1_000);
    await utimes(postFile, later, later);
    expect((await stat(postFile)).size).toBe(initialSize);

    const changed = loadContent();
    expect(changed).not.toBe(first);
    expect(changed.posts[0].title).toBe("After!");
  });

  test("never caches an explicitly supplied content root", async () => {
    const root = await createContentRoot();
    await writePost(
      root,
      "fixture.md",
      "title: Before\ndate: 2026-01-02\nexcerpt: Before\npublished: true",
    );
    const first = loadContent(root);

    await writePost(
      root,
      "fixture.md",
      "title: After\ndate: 2026-01-02\nexcerpt: After\npublished: true",
    );
    const changed = loadContent(root);

    expect(changed).not.toBe(first);
    expect(changed.posts[0].title).toBe("After");
  });
});

describe("validatePost", () => {
  test("rejects an arbitrary Date object", () => {
    expect(() =>
      validatePost(
        {
          title: "Post",
          date: new Date("2026-01-02T00:00:00.000Z"),
          excerpt: "Excerpt",
          published: true,
        },
        "post.md",
      ),
    ).toThrow("post.md: invalid or missing date");
  });

  test("rejects a missing excerpt", () => {
    expect(() =>
      validatePost(
        { title: "Post", date: "2026-01-02", published: true },
        "post.md",
      ),
    ).toThrow("post.md: invalid or missing excerpt");
  });

  test("rejects a non-boolean published value", () => {
    expect(() =>
      validatePost(
        {
          title: "Post",
          date: "2026-01-02",
          excerpt: "Excerpt",
          published: "yes",
        },
        "post.md",
      ),
    ).toThrow("post.md: invalid or missing published");
  });

  test("rejects a non-string optional category", () => {
    expect(() =>
      validatePost(
        {
          title: "Post",
          date: "2026-01-02",
          category: 42,
          excerpt: "Excerpt",
          published: true,
        },
        "post.md",
      ),
    ).toThrow("post.md: invalid or missing category");
  });
});

describe("validateSite", () => {
  test("rejects an empty name", () => {
    expect(() =>
      validateSite({ name: " ", author: "Vic", tagline: "" }, "site.md"),
    ).toThrow("site.md: invalid or missing name");
  });

  test("rejects a missing author", () => {
    expect(() => validateSite({ name: "Vic Log", tagline: "" }, "site.md")).toThrow(
      "site.md: invalid or missing author",
    );
  });

  test("requires a string tagline but allows it to be empty", () => {
    expect(() => validateSite({ name: "Vic Log", author: "Vic" }, "site.md")).toThrow(
      "site.md: invalid or missing tagline",
    );
    expect(
      validateSite({ name: "Vic Log", author: "Vic", tagline: "" }, "site.md"),
    ).toMatchObject({ tagline: "" });
  });

  test.each(["avatar", "email", "github"])(
    "rejects a non-string optional %s",
    (field) => {
      expect(() =>
        validateSite(
          { name: "Vic Log", author: "Vic", tagline: "", [field]: 42 },
          "site.md",
        ),
      ).toThrow(`site.md: invalid or missing ${field}`);
    },
  );
});
