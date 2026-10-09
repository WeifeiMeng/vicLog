import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/content", () => ({
  getPosts: () => [
    {
      slug: "agent-note",
      title: "Agent note",
      author: "Vic Agent",
      date: "2026-10-09",
      excerpt: "Excerpt",
      published: true,
      body: "",
    },
  ],
  groupPostsByYear: (posts: unknown[]) => [{ year: "2026", posts }],
}));

import ArchivePage from "./page";

test("renders authors in the archive list", () => {
  expect(renderToStaticMarkup(<ArchivePage />)).toContain("作者 · Vic Agent");
});
