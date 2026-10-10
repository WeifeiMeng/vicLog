import { describe, expect, test } from "vitest";

import { assertSameOrigin, isRequestSecure } from "./request";

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

describe("request transport security", () => {
  test("treats direct HTTP as insecure and direct HTTPS as secure", () => {
    expect(isRequestSecure(new Request("http://example.test/api/write/login"))).toBe(false);
    expect(isRequestSecure(new Request("https://example.test/api/write/login"))).toBe(true);
  });

  test("trusts the forwarded protocol supplied by the reverse proxy", () => {
    expect(
      isRequestSecure(
        new Request("http://127.0.0.1:3000/api/write/login", {
          headers: { "x-forwarded-proto": "https" },
        }),
      ),
    ).toBe(true);
    expect(
      isRequestSecure(
        new Request("https://example.test/api/write/login", {
          headers: { "x-forwarded-proto": "http" },
        }),
      ),
    ).toBe(false);
  });
});
