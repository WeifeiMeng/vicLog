import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { dump as dumpYaml, JSON_SCHEMA, load as loadYaml } from "js-yaml";

import { validatePost } from "@/lib/content/validate";

import { WriteError } from "./errors";
import type { EditablePost, PostInput, PostSummary } from "./types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface PostStore {
  list(): Promise<PostSummary[]>;
  read(slug: string): Promise<EditablePost>;
  create(input: PostInput): Promise<EditablePost>;
  update(slug: string, input: PostInput, version: string): Promise<EditablePost>;
  remove(slug: string, version: string): Promise<void>;
  pathFor(slug: string): string;
}

export function validatePostInput(input: PostInput): PostInput {
  if (!SLUG_PATTERN.test(input.slug) || input.slug.length > 100) {
    throw new WriteError("INVALID_INPUT", "slug 必须是最长 100 字符的小写 kebab-case");
  }
  if (typeof input.body !== "string" || typeof input.category !== "string") {
    throw new WriteError("INVALID_INPUT", "文章正文或分类格式不正确");
  }
  try {
    const validated = validatePost(
      {
        title: input.title.trim(),
        date: input.date,
        category: input.category.trim() || undefined,
        excerpt: input.excerpt.trim(),
        published: input.published,
      },
      `${input.slug}.md`,
    );
    return {
      ...input,
      title: validated.title,
      date: validated.date,
      category: validated.category ?? "",
      excerpt: validated.excerpt,
      published: validated.published,
    };
  } catch (cause) {
    throw new WriteError(
      "INVALID_INPUT",
      cause instanceof Error ? cause.message : "文章字段格式不正确",
      { cause },
    );
  }
}

export function serializePost(raw: PostInput): string {
  const input = validatePostInput(raw);
  const frontmatter = dumpYaml(
    {
      title: input.title,
      date: input.date,
      ...(input.category ? { category: input.category } : {}),
      excerpt: input.excerpt,
      published: input.published,
    },
    { schema: JSON_SCHEMA, lineWidth: -1, noRefs: true },
  ).trimEnd();
  return `---\n${frontmatter}\n---\n${input.body.replace(/^\n+/, "").trimEnd()}\n`;
}

export function createPostStore(contentRoot: string): PostStore {
  const postsRoot = path.resolve(contentRoot, "posts");

  function pathFor(slug: string): string {
    validatePostInput({
      slug,
      title: "path",
      date: "2000-01-01",
      category: "",
      excerpt: "path",
      published: false,
      body: "",
    });
    return path.join(postsRoot, `${slug}.md`);
  }

  async function read(slug: string): Promise<EditablePost> {
    const file = pathFor(slug);
    let source: string;
    try {
      source = await readFile(file, "utf8");
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
        throw new WriteError("NOT_FOUND", `文章 ${slug} 不存在`, { cause });
      }
      throw cause;
    }
    try {
      const parsed = matter(source, {
        engines: {
          yaml: {
            parse(value) {
              const data = loadYaml(value, { schema: JSON_SCHEMA });
              return data !== null && typeof data === "object" ? data : {};
            },
          },
        },
      });
      const data = validatePost(parsed.data, file);
      return {
        slug,
        title: data.title,
        date: data.date,
        category: data.category ?? "",
        excerpt: data.excerpt,
        published: data.published,
        body: parsed.content.replace(/^\n/, ""),
        version: versionOf(source),
      };
    } catch (cause) {
      if (cause instanceof WriteError) throw cause;
      throw new WriteError("INVALID_INPUT", `${slug}.md 的 Markdown 或 frontmatter 无效`, {
        cause,
      });
    }
  }

  async function atomicWrite(file: string, source: string): Promise<void> {
    await mkdir(postsRoot, { recursive: true });
    const temporary = path.join(postsRoot, `.${path.basename(file)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, source, { encoding: "utf8", flag: "wx" });
      await rename(temporary, file);
    } finally {
      if (existsSync(temporary)) await unlink(temporary);
    }
  }

  return {
    pathFor,
    read,
    async list() {
      await mkdir(postsRoot, { recursive: true });
      const names = (await readdir(postsRoot))
        .filter((name) => name.endsWith(".md"))
        .map((name) => name.slice(0, -3));
      const posts = await Promise.all(names.map(read));
      return posts
        .sort((left, right) => right.date.localeCompare(left.date) || right.slug.localeCompare(left.slug))
        .map(({ body: _body, ...summary }) => summary);
    },
    async create(input) {
      const validated = validatePostInput(input);
      const file = pathFor(validated.slug);
      if (existsSync(file)) {
        throw new WriteError("SLUG_CONFLICT", `slug ${validated.slug} 已存在`);
      }
      await atomicWrite(file, serializePost(validated));
      return read(validated.slug);
    },
    async update(slug, input, version) {
      const current = await read(slug);
      if (current.version !== version) {
        throw new WriteError("VERSION_CONFLICT", "文章已被其他操作修改，请刷新后重试");
      }
      const validated = validatePostInput(input);
      const oldFile = pathFor(slug);
      const newFile = pathFor(validated.slug);
      if (slug !== validated.slug && existsSync(newFile)) {
        throw new WriteError("SLUG_CONFLICT", `slug ${validated.slug} 已存在`);
      }
      await atomicWrite(newFile, serializePost(validated));
      if (oldFile !== newFile) await unlink(oldFile);
      return read(validated.slug);
    },
    async remove(slug, version) {
      const current = await read(slug);
      if (current.version !== version) {
        throw new WriteError("VERSION_CONFLICT", "文章已被其他操作修改，请刷新后重试");
      }
      await unlink(pathFor(slug));
    },
  };
}

function versionOf(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}
