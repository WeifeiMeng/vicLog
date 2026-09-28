import { NextRequest } from "next/server";

import { jsonData, jsonError } from "@/lib/write/http";
import { assertSameOrigin } from "@/lib/write/request";
import { getWriteRuntime, requireApiSession } from "@/lib/write/server";
import type { PostInput } from "@/lib/write/types";

export async function GET(request: NextRequest) {
  try {
    requireApiSession(request);
    return jsonData(await getWriteRuntime().store.list());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    requireApiSession(request);
    const input = (await request.json()) as PostInput;
    return jsonData(await getWriteRuntime().service.create(input));
  } catch (error) {
    return jsonError(error);
  }
}
