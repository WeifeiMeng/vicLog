import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

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
