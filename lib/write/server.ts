import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "./auth";
import { loadWriteConfig } from "./config";
import { WriteError } from "./errors";
import { createGitClient } from "./git";
import { createPostStore } from "./posts";
import { createWriteService } from "./service";

let runtime: ReturnType<typeof buildRuntime> | undefined;

function buildRuntime() {
  const config = loadWriteConfig();
  const store = createPostStore(config.contentRoot);
  const service = createWriteService(store, createGitClient(config.repoRoot), (oldSlug, newSlug) => {
    revalidatePath("/");
    revalidatePath("/archive");
    revalidatePath("/rss.xml");
    if (oldSlug) revalidatePath(`/posts/${oldSlug}`);
    if (newSlug && newSlug !== oldSlug) revalidatePath(`/posts/${newSlug}`);
  });
  return { config, store, service };
}

export function getWriteRuntime() {
  runtime ??= buildRuntime();
  return runtime;
}

export function requireApiSession(request: NextRequest): void {
  const { config } = getWriteRuntime();
  if (!verifySession(request.cookies.get(SESSION_COOKIE)?.value, config.sessionSecret)) {
    throw new WriteError("UNAUTHORIZED", "请先登录写作后台");
  }
}
