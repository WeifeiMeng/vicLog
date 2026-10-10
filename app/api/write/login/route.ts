import { NextRequest, NextResponse } from "next/server";

import {
  createSession,
  LoginLimiter,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifyPassword,
} from "@/lib/write/auth";
import { WriteError } from "@/lib/write/errors";
import { jsonError } from "@/lib/write/http";
import { assertSameOrigin, isRequestSecure } from "@/lib/write/request";
import { getWriteRuntime } from "@/lib/write/server";

const limiter = new LoginLimiter();

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (limiter.isBlocked(source)) {
      throw new WriteError("RATE_LIMITED", "尝试次数过多，请稍后再试");
    }
    const body = (await request.json()) as { password?: unknown };
    const { config } = getWriteRuntime();
    if (typeof body.password !== "string" || !verifyPassword(body.password, config.password)) {
      limiter.recordFailure(source);
      throw new WriteError("UNAUTHORIZED", "密码不正确");
    }
    limiter.clear(source);
    const response = NextResponse.json({ data: { authenticated: true } });
    response.cookies.set(SESSION_COOKIE, createSession(config.sessionSecret), {
      httpOnly: true,
      sameSite: "strict",
      secure: isRequestSecure(request),
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
