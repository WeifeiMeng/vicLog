import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "vic_write_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export function verifyPassword(candidate: string, expected: string): boolean {
  const candidateDigest = createHmac("sha256", "vic-log-password").update(candidate).digest();
  const expectedDigest = createHmac("sha256", "vic-log-password").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

export function createSession(secret: string, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: now + SESSION_MAX_AGE_SECONDS * 1_000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return false;
  }
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      expiresAt?: unknown;
    };
    return typeof value.expiresAt === "number" && value.expiresAt >= now;
  } catch {
    return false;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

interface AttemptState {
  count: number;
  blockedUntil: number;
}

export class LoginLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  constructor(
    private readonly maximumFailures = 5,
    private readonly blockDurationMs = 60_000,
  ) {}

  isBlocked(source: string, now = Date.now()): boolean {
    const state = this.attempts.get(source);
    if (!state) return false;
    if (state.blockedUntil > now) return true;
    if (state.blockedUntil > 0) this.attempts.delete(source);
    return false;
  }

  recordFailure(source: string, now = Date.now()): void {
    const previous = this.attempts.get(source);
    const count = (previous?.blockedUntil && previous.blockedUntil <= now ? 0 : previous?.count ?? 0) + 1;
    this.attempts.set(source, {
      count,
      blockedUntil: count >= this.maximumFailures ? now + this.blockDurationMs : 0,
    });
  }

  clear(source: string): void {
    this.attempts.delete(source);
  }
}
