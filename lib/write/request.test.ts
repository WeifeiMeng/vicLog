import { describe, expect, test } from "vitest";

import { assertSameOrigin } from "./request";

describe("same-origin mutation check", () => {
  test("accepts matching origin", () => {
    const request = new Request("http://localhost:3000/api/write/posts", {
      headers: { origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  test("rejects missing or cross-origin requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/write/posts"))).toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost:3000/api/write/posts", {
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow();
  });
});
