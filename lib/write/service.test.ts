import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createGitClient } from "./git";
import { createPostStore } from "./posts";
import { createWriteService } from "./service";

const execFile = promisify(execFileCallback);
const roots: string[] = [];
const input = {
  slug: "safe-post",
  title: "Safe post",
  date: "2026-09-28",
  category: "",
  excerpt: "Safe excerpt",
  published: false,
  body: "Before\n",
};

async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "vic-write-service-"));
  roots.push(root);
  await mkdir(path.join(root, "content", "posts"), { recursive: true });
  await execFile("git", ["init", "-q"], { cwd: root });
  await execFile("git", ["config", "user.name", "Vic Test"], { cwd: root });
  await execFile("git", ["config", "user.email", "vic@example.test"], { cwd: root });
  await writeFile(path.join(root, "README.md"), "base\n");
  await execFile("git", ["add", "."], { cwd: root });
  await execFile("git", ["commit", "-qm", "initial"], { cwd: root });
  const store = createPostStore(path.join(root, "content"));
  return { root, store };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("write service", () => {
  test("creates one commit and calls invalidation", async () => {
    const { root, store } = await setup();
    const invalidate = vi.fn();
    const service = createWriteService(store, createGitClient(root), invalidate);
    const created = await service.create(input);

    expect(created.version).toHaveLength(64);
    expect(invalidate).toHaveBeenCalledWith(undefined, "safe-post");
    expect(
      (await execFile("git", ["log", "-1", "--pretty=%s"], { cwd: root })).stdout.trim(),
    ).toBe("content: create safe-post");
  });

  test("restores exact file bytes when git commit fails", async () => {
    const { store } = await setup();
    const goodService = createWriteService(store, { commit: async () => {}, reset: async () => {} });
    const created = await goodService.create(input);
    const file = store.pathFor("safe-post");
    const before = await readFile(file);
    const failing = createWriteService(store, {
      commit: async () => {
        throw new Error("git failed");
      },
      reset: async () => {},
    });

    await expect(
      failing.update("safe-post", { ...input, body: "After\n" }, created.version),
    ).rejects.toMatchObject({ code: "GIT_ERROR" });
    expect(await readFile(file)).toEqual(before);
  });
});
