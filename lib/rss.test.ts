import { describe, expect, test } from "vitest";

import { escapeXml } from "./rss";

describe("escapeXml", () => {
  test("escapes XML-sensitive characters", () => {
    expect(escapeXml('A & B < C > D "Q"')).toBe(
      "A &amp; B &lt; C &gt; D &quot;Q&quot;",
    );
  });
});
