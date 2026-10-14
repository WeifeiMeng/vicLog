import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

async function readRepositoryFile(path: string): Promise<string> {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  } catch {
    return "";
  }
}

describe("content-only deployment", () => {
  test("runs only when published content changes on main", async () => {
    const workflow = await readRepositoryFile(".github/workflows/deploy-content.yml");

    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain('      - "content/**"');
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("VICLOG_DEPLOY_SSH_KEY");
    expect(workflow).toContain("VICLOG_SSH_KNOWN_HOSTS");
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).not.toMatch(/docker\s+(build|compose|load|pull|run)/);
  });

  test("fails safely instead of overwriting server changes", async () => {
    const script = await readRepositoryFile("deploy/sync-content.sh");

    expect(script).toContain("set -Eeuo pipefail");
    expect(script).toContain('repository="/opt/viclog"');
    expect(script).toContain("status --porcelain");
    expect(script).toContain("fetch --prune origin main");
    expect(script).toContain("rebase origin/main");
    expect(script).toContain("rebase --abort");
    expect(script).toContain("http://127.0.0.1:3001/");
    expect(script).not.toContain("reset --hard");
  });
});
