import { describe, expect, test } from "vitest";

import { filterPostSummaries } from "./admin-state";
import type { PostSummary } from "./types";

const posts = [
  { slug: "public-note", title: "公开文章", author: "Vic", excerpt: "hello", published: true },
  { slug: "draft-note", title: "草稿", author: "Vic Agent", excerpt: "private thought", published: false },
] as PostSummary[];

describe("admin article filtering", () => {
  test("filters by status and searchable text", () => {
    expect(filterPostSummaries(posts, "draft", "").map(({ slug }) => slug)).toEqual([
      "draft-note",
    ]);
    expect(filterPostSummaries(posts, "all", "private").map(({ slug }) => slug)).toEqual([
      "draft-note",
    ]);
    expect(filterPostSummaries(posts, "published", "草稿")).toEqual([]);
  });
});
