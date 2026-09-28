import { describe, expect, test } from "vitest";

import {
  LoginLimiter,
  createSession,
  verifyPassword,
  verifySession,
} from "./auth";
import { loadWriteConfig } from "./config";

const secret = "a".repeat(32);

describe("write configuration", () => {
  test("requires password and a 32-character session secret", () => {
    expect(() => loadWriteConfig({})).toThrow(/WRITE_PASSWORD/);
    expect(() => loadWriteConfig({ WRITE_PASSWORD: "pw", SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/,
    );
  });
});

describe("write authentication", () => {
  test("compares passwords without accepting different values", () => {
    expect(verifyPassword("correct", "correct")).toBe(true);
    expect(verifyPassword("wrong", "correct")).toBe(false);
  });

  test("round-trips a signed session and rejects tampering or expiry", () => {
    const now = Date.UTC(2026, 8, 28, 8);
    const token = createSession(secret, now);
    expect(verifySession(token, secret, now + 1_000)).toBe(true);
    expect(verifySession(`${token}x`, secret, now + 1_000)).toBe(false);
    expect(verifySession(token, secret, now + 8 * 60 * 60 * 1_000 + 1)).toBe(false);
  });

  test("temporarily blocks a source after five failures", () => {
    const limiter = new LoginLimiter(5, 60_000);
    for (let index = 0; index < 5; index += 1) limiter.recordFailure("local", 1_000);
    expect(limiter.isBlocked("local", 1_001)).toBe(true);
    expect(limiter.isBlocked("local", 61_001)).toBe(false);
    limiter.recordFailure("local", 70_000);
    limiter.clear("local");
    expect(limiter.isBlocked("local", 70_001)).toBe(false);
  });
});
