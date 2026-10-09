import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

const { post } = vi.hoisted(() => ({
  post: {
    slug: "agent-note",
    title: "Agent note",
    author: "Vic Agent",
    date: "2026-10-09",
    excerpt: "Excerpt",
    published: true,
    body: "Body",
  },
}));

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
