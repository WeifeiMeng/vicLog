import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const contentRoot = path.join(process.cwd(), "content", "posts");
const publicRoot = path.join(process.cwd(), "public");

test("local Markdown images use existing public URLs", () => {
  for (const filename of readdirSync(contentRoot).filter((name) => name.endsWith(".md"))) {
    const source = readFileSync(path.join(contentRoot, filename), "utf8");
    const imageUrls = [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(
      (match) => match[1],
    );

    for (const imageUrl of imageUrls) {
      if (/^https?:\/\//i.test(imageUrl)) continue;

      expect(
        imageUrl.startsWith("/"),
        `${filename}: local image ${imageUrl} must use a public URL beginning with /`,
      ).toBe(true);
      expect(
        existsSync(path.join(publicRoot, imageUrl.slice(1))),
        `${filename}: public image ${imageUrl} does not exist`,
      ).toBe(true);
    }
  }
});
