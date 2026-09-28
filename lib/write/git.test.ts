import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

import { createGitClient } from "./git";

const execFile = promisify(execFileCallback);
const roots: string[] = [];

async function git(root: string, args: string[]) {
  return execFile("git", args, { cwd: root });
}

async function repository() {
  const root = await mkdtemp(path.join(tmpdir(), "vic-write-git-"));
  roots.push(root);
  await git(root, ["init", "-q"]);
  await git(root, ["config", "user.name", "Vic Test"]);
  await git(root, ["config", "user.email", "vic@example.test"]);
  await writeFile(path.join(root, "base.txt"), "base\n");
  await writeFile(path.join(root, "staged.txt"), "before\n");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-qm", "initial"]);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("path-scoped git commits", () => {
  test("commits only target paths and preserves unrelated staged and unstaged work", async () => {
    const root = await repository();
    await writeFile(path.join(root, "staged.txt"), "staged change\n");
    await git(root, ["add", "staged.txt"]);
    await writeFile(path.join(root, "base.txt"), "unstaged change\n");
    await writeFile(path.join(root, "post.md"), "post\n");

    await createGitClient(root).commit(["post.md"], "content: create post");

    const changed = (await git(root, ["show", "--pretty=", "--name-only", "HEAD"])).stdout.trim();
    expect(changed).toBe("post.md");
    expect((await git(root, ["diff", "--cached", "--name-only"])).stdout.trim()).toBe(
      "staged.txt",
    );
    expect((await git(root, ["diff", "--name-only"])).stdout.trim()).toBe("base.txt");
  });

  test("commits rename and delete pathspecs", async () => {
    const root = await repository();
    await writeFile(path.join(root, "old.md"), "old\n");
    await git(root, ["add", "old.md"]);
    await git(root, ["commit", "-qm", "old"]);
    await writeFile(path.join(root, "new.md"), await readFile(path.join(root, "old.md")));
    await rm(path.join(root, "old.md"));

    const client = createGitClient(root);
    await client.commit(["old.md", "new.md"], "content: rename old to new");
    expect((await git(root, ["show", "--pretty=", "--name-status", "HEAD"])).stdout).toMatch(
      /R\d+\s+old\.md\s+new\.md/,
    );
    await rm(path.join(root, "new.md"));
    await client.commit(["new.md"], "content: delete new");
    expect((await git(root, ["show", "--pretty=", "--name-status", "HEAD"])).stdout.trim()).toBe(
      "D\tnew.md",
    );
  });
});
