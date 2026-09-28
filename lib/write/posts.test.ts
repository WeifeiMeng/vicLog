import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  createPostStore,
  serializePost,
  validatePostInput,
} from "./posts";

const roots: string[] = [];

async function makeRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "vic-write-posts-"));
  roots.push(root);
  await mkdir(path.join(root, "posts"));
  return root;
}

const draft = {
  slug: "hello-world",
  title: "Hello: world",
  date: "2026-09-28",
  category: "随笔",
  excerpt: "A short note",
  published: false,
  body: "## Hello\n\nDraft body.\n",
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("write post validation", () => {
  test.each(["../escape", "Uppercase", "under_score", "a".repeat(101)])(
    "rejects unsafe slug %s",
    (slug) => expect(() => validatePostInput({ ...draft, slug })).toThrow(/slug/i),
  );

  test("rejects invalid fields", () => {
    expect(() => validatePostInput({ ...draft, title: " " })).toThrow(/title/i);
    expect(() => validatePostInput({ ...draft, excerpt: "" })).toThrow(/excerpt/i);
    expect(() => validatePostInput({ ...draft, date: "2026-02-30" })).toThrow(/date/i);
  });

  test("serializes YAML-safe frontmatter that round-trips", async () => {
    const root = await makeRoot();
    const store = createPostStore(root);
    await writeFile(path.join(root, "posts", "hello-world.md"), serializePost(draft));

    expect(await store.read("hello-world")).toMatchObject(draft);
  });
});

describe("post store", () => {
  test("lists published and draft posts newest first", async () => {
    const root = await makeRoot();
    const store = createPostStore(root);
    await store.create(draft);
    await store.create({
      ...draft,
      slug: "newer",
      title: "Newer",
      date: "2026-09-29",
      published: true,
    });

    expect((await store.list()).map(({ slug, published }) => [slug, published])).toEqual([
      ["newer", true],
      ["hello-world", false],
    ]);
  });

  test("requires the current version and supports rename", async () => {
    const root = await makeRoot();
    const store = createPostStore(root);
    const created = await store.create(draft);

    await expect(
      store.update("hello-world", { ...draft, title: "Changed" }, "stale"),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

    const renamed = await store.update(
      "hello-world",
      { ...draft, slug: "renamed", title: "Changed" },
      created.version,
    );
    expect(renamed.slug).toBe("renamed");
    await expect(store.read("hello-world")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects duplicate creates and rename collisions", async () => {
    const root = await makeRoot();
    const store = createPostStore(root);
    const first = await store.create(draft);
    await expect(store.create(draft)).rejects.toMatchObject({ code: "SLUG_CONFLICT" });
    await store.create({ ...draft, slug: "occupied", title: "Occupied" });
    await expect(
      store.update("hello-world", { ...draft, slug: "occupied" }, first.version),
    ).rejects.toMatchObject({ code: "SLUG_CONFLICT" });
  });

  test("deletes only with the current version", async () => {
    const root = await makeRoot();
    const store = createPostStore(root);
    const created = await store.create(draft);
    await expect(store.remove("hello-world", "stale")).rejects.toMatchObject({
      code: "VERSION_CONFLICT",
    });
    await store.remove("hello-world", created.version);
    await expect(readFile(path.join(root, "posts", "hello-world.md"))).rejects.toThrow();
  });
});
