import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { PostAuthor } from "./post-meta";

test("renders an explicit article author label", () => {
  expect(renderToStaticMarkup(<PostAuthor author="Vic Agent" />)).toContain(
    "作者 · Vic Agent",
  );
});
