import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { MarkdownContent } from "./markdown-content";

test("renders inline and display LaTeX formulas with KaTeX", () => {
  const markup = renderToStaticMarkup(
    <MarkdownContent>{String.raw`第 $n$ 轮：

$$
L_n = L_0 + \sum_{i=1}^{n-1} \Delta L_i
$$`}</MarkdownContent>,
  );

  expect(markup).toContain('<span class="katex">');
  expect(markup).toContain('<span class="katex-display">');
  expect(markup).toContain("∑");
  expect(markup).not.toContain("<p>$$");
});
