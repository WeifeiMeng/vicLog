import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/write/auth";
import { jsonError } from "@/lib/write/http";
import { assertSameOrigin } from "@/lib/write/request";

export function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const response = NextResponse.json({ data: { authenticated: false } });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
