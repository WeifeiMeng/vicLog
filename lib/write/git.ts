import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { WriteError } from "./errors";

const execFile = promisify(execFileCallback);

export interface GitClient {
  commit(paths: string[], message: string): Promise<void>;
  reset(paths: string[]): Promise<void>;
}

export function createGitClient(repoRoot: string): GitClient {
  const root = path.resolve(repoRoot);

  function relativePaths(paths: string[]): string[] {
    return [...new Set(paths.map((item) => {
      const relative = path.isAbsolute(item) ? path.relative(root, item) : item;
      if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`)) {
        throw new WriteError("GIT_ERROR", "文章路径不在 Git 仓库内");
      }
      return relative.split(path.sep).join("/");
    }))];
  }

  async function run(args: string[]): Promise<void> {
    try {
      await execFile("git", args, { cwd: root });
    } catch (cause) {
      const stderr = (cause as { stderr?: string }).stderr?.trim();
      throw new WriteError(
        "GIT_ERROR",
        stderr ? `Git 操作失败：${stderr}` : "Git 操作失败，请检查仓库和作者配置",
        { cause },
      );
    }
  }

  return {
    async commit(paths, message) {
      const relative = relativePaths(paths);
      await run(["add", "-A", "--", ...relative]);
      await run(["commit", "--only", "-m", message, "--", ...relative]);
    },
    async reset(paths) {
      const relative = relativePaths(paths);
      try {
        await execFile("git", ["reset", "-q", "HEAD", "--", ...relative], { cwd: root });
      } catch {
        await execFile("git", ["rm", "--cached", "--ignore-unmatch", "--", ...relative], {
          cwd: root,
        });
      }
    },
  };
}
