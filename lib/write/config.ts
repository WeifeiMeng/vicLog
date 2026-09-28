import path from "node:path";

import { WriteError } from "./errors";

export interface WriteConfig {
  password: string;
  sessionSecret: string;
  contentRoot: string;
  repoRoot: string;
}

export function loadWriteConfig(
  environment: Record<string, string | undefined> = process.env,
): WriteConfig {
  const password = environment.WRITE_PASSWORD;
  if (!password) {
    throw new WriteError("CONFIG_ERROR", "缺少 WRITE_PASSWORD 环境变量");
  }
  const sessionSecret = environment.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new WriteError("CONFIG_ERROR", "SESSION_SECRET 必须至少包含 32 个字符");
  }
  const repoRoot = path.resolve(
    /* turbopackIgnore: true */ environment.REPO_ROOT ?? process.cwd(),
  );
  const contentRoot = path.resolve(
    /* turbopackIgnore: true */ environment.CONTENT_ROOT ?? path.join(repoRoot, "content"),
  );
  return { password, sessionSecret, contentRoot, repoRoot };
}
