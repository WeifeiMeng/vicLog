import { NextRequest } from "next/server";

import { jsonData, jsonError } from "@/lib/write/http";
import { assertSameOrigin } from "@/lib/write/request";
import { getWriteRuntime, requireApiSession } from "@/lib/write/server";
import type { PostInput } from "@/lib/write/types";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireApiSession(request);
    const { slug } = await context.params;
    return jsonData(await getWriteRuntime().store.read(slug));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    requireApiSession(request);
    const { slug } = await context.params;
    const body = (await request.json()) as { input: PostInput; version: string };
    return jsonData(await getWriteRuntime().service.update(slug, body.input, body.version));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    assertSameOrigin(request);
    requireApiSession(request);
    const { slug } = await context.params;
    const body = (await request.json()) as { version: string };
    await getWriteRuntime().service.remove(slug, body.version);
    return jsonData({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
