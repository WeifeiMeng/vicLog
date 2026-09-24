import { describe, expect, test } from "vitest";

import { normalizeSiteUrl } from "./site-url";

describe("normalizeSiteUrl", () => {
  test("normalizes a provided origin with trailing slashes", () => {
    expect(normalizeSiteUrl("https://blog.example.com///")).toBe(
      "https://blog.example.com",
    );
  });

  test("rejects a provided URL that is not an origin", () => {
    expect(() => normalizeSiteUrl("https://example.com/blog")).toThrow(
      /NEXT_PUBLIC_SITE_URL must be an absolute http\(s\) origin/,
    );
  });
});
