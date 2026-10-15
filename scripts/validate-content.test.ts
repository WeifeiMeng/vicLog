import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";

const execFile = promisify(execFileCallback);
const validator = path.resolve("scripts/validate-content.mjs");
const temporaryDirectories: string[] = [];

interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

async function createContentRoot(): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "viclog-content-validator-"));
  temporaryDirectories.push(workspace);

  const contentRoot = path.join(workspace, "content");
  await mkdir(path.join(contentRoot, "posts"), { recursive: true });
  return contentRoot;
}

async function runValidator(contentRoot: string): Promise<CommandResult> {
  try {
    const result = await execFile(process.execPath, [
      validator,
      "--content-root",
      contentRoot,
    ]);
    return { ...result, code: 0 };
  } catch (error) {
    return error as Error & CommandResult;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

test("reports a missing closing frontmatter delimiter with a GitHub annotation", async () => {
  const contentRoot = await createContentRoot();
  await writeFile(
    path.join(contentRoot, "site.md"),
    [
      "---",
      "## name: Vic's blog",
      "author: Meng Weifei",
      "",
      "## About",
    ].join("\n"),
  );

  const result = await runValidator(contentRoot);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain(
    'content/site.md:1: missing closing frontmatter delimiter "---"',
  );
  expect(result.stderr).toContain(
    "::error file=content/site.md,line=1,title=Invalid Markdown frontmatter::",
  );
});

test("reports the exact missing post field", async () => {
  const contentRoot = await createContentRoot();
  await writeFile(
    path.join(contentRoot, "site.md"),
    [
      "---",
      "name: Vic's blog",
      "author: Meng Weifei",
      "tagline: AI Agent Engineer",
      "---",
      "",
      "## About",
    ].join("\n"),
  );
  await writeFile(
    path.join(contentRoot, "posts", "missing-author.md"),
    [
      "---",
      "title: Missing author",
      "date: 2026-10-15",
      "excerpt: Test post",
      "published: true",
      "---",
      "",
      "Body",
    ].join("\n"),
  );

  const result = await runValidator(contentRoot);

  expect(result.code).toBe(1);
  expect(result.stderr).toContain(
    'content/posts/missing-author.md:1: missing or invalid "author" field',
  );
});
