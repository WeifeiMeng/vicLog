import { describe, expect, test } from "vitest";

import { WriteError } from "./errors";
import { errorStatus, jsonError } from "./http";

describe("write API errors", () => {
  test.each([
    ["INVALID_INPUT", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["VERSION_CONFLICT", 409],
    ["SLUG_CONFLICT", 409],
    ["RATE_LIMITED", 429],
    ["GIT_ERROR", 500],
  ] as const)("maps %s to %i", (code, status) => {
    expect(errorStatus(new WriteError(code, "message"))).toBe(status);
  });

  test("does not expose unexpected internal errors", async () => {
    const response = jsonError(new Error("secret filesystem detail"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_ERROR", message: "服务器处理请求失败" },
    });
  });
});
