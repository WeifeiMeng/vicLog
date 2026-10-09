import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { PostCard } from "./post-card";

describe("PostCard", () => {
  test("renders the post summary with a trailing-slash article link", () => {
    const markup = renderToStaticMarkup(
      <PostCard
        post={{
          slug: "example",
          title: "示例文章",
          author: "Vic Agent",
          date: "2026-09-24",
          category: "工程",
          excerpt: "这是一段摘要。",
          published: true,
          body: "",
        }}
      />,
    );

    expect(markup).toContain("示例文章");
    expect(markup).toContain("2026年9月24日");
    expect(markup).toContain("工程");
    expect(markup).toContain("作者 · Vic Agent");
    expect(markup).toContain("这是一段摘要。");
    expect(markup).toContain('href="/posts/example/"');
  });
});
