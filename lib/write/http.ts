import { NextResponse } from "next/server";

import { WriteError } from "./errors";

export function errorStatus(error: unknown): number {
  if (!(error instanceof WriteError)) return 500;
  return {
    INVALID_INPUT: 400,
    CONFIG_ERROR: 500,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SLUG_CONFLICT: 409,
    VERSION_CONFLICT: 409,
    RATE_LIMITED: 429,
    GIT_ERROR: 500,
    INTERNAL_ERROR: 500,
  }[error.code];
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof WriteError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: errorStatus(error) },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "服务器处理请求失败" } },
    { status: 500 },
  );
}

export function jsonData<T>(data: T): NextResponse {
  return NextResponse.json({ data });
}
