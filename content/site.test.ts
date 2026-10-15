import { expect, test } from "vitest";

import { loadContent } from "../lib/content";

test("keeps the repository site content parseable", () => {
  const { site } = loadContent();

  expect(site).toMatchObject({
    name: "Vic's blog",
    author: "Meng Weifei",
    tagline: "AI Agent 工程师 · AI 全栈工程师 · 独立开发者",
    email: "vicmeng.dog@gmail.com",
    github: "https://github.com/WeifeiMeng/",
  });
  expect(site.body).toContain("## 💼 Curriculum vitae");
});
