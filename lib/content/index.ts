import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { JSON_SCHEMA, load as loadYaml } from "js-yaml";

import type { ContentCollection, Post } from "./types";
import { validatePost, validateSite } from "./validate";

interface ContentCacheEntry {
  root: string;
  signature: string;
  content: ContentCollection;
}

let defaultContentCache: ContentCacheEntry | undefined;

export function loadContent(contentRoot?: string): ContentCollection {
  const isDefaultRoot = contentRoot === undefined;
  const resolvedRoot = contentRoot ?? path.join(process.cwd(), "content");
  const siteFile = path.join(resolvedRoot, "site.md");
  if (!existsSync(siteFile)) {
    throw new Error(`${siteFile}: missing site content`);
  }
  const postDirectory = path.join(resolvedRoot, "posts");
  const postFiles = readdirSync(postDirectory)
    .filter((filename) => path.extname(filename) === ".md")
    .sort()
    .map((filename) => path.join(postDirectory, filename));
  const signature = isDefaultRoot
    ? createContentSignature([siteFile, ...postFiles])
    : undefined;
  if (
    signature !== undefined &&
    defaultContentCache?.root === resolvedRoot &&
    defaultContentCache.signature === signature
  ) {
    return defaultContentCache.content;
  }

  const parsedSite = parseMarkdown(siteFile);
  const site = {
    ...validateSite(parsedSite.data, siteFile),
    body: parsedSite.content,
  };

  const posts = postFiles
    .map((postFile) => {
      const slug = path.basename(postFile, ".md");
      assertValidPostSlug(slug, postFile);
      const parsedPost = parseMarkdown(postFile);
      return {
        ...validatePost(parsedPost.data, postFile),
        slug,
        body: parsedPost.content,
      };
    })
    .filter((post) => post.published)
    .sort((left, right) => {
      const byDate = right.date.localeCompare(left.date);
      if (byDate !== 0) return byDate;
      if (left.slug === right.slug) return 0;
      return left.slug < right.slug ? 1 : -1;
    });

  const content = { site, posts };
  if (signature !== undefined) {
    defaultContentCache = { root: resolvedRoot, signature, content };
  }
  return content;
}

export function getSite(): ContentCollection["site"] {
  return loadContent().site;
}

export function getPosts(): Post[] {
  return loadContent().posts;
}

export function getPost(slug: string): Post | undefined {
  return getPosts().find((post) => post.slug === slug);
}

export function getAdjacentPosts(
  slug: string,
): { previous?: Post; next?: Post } {
  const posts = getPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return {};

  return {
    ...(posts[index + 1] ? { previous: posts[index + 1] } : {}),
    ...(posts[index - 1] ? { next: posts[index - 1] } : {}),
  };
}

export function groupPostsByYear(
  posts: Post[],
): Array<{ year: string; posts: Post[] }> {
  const grouped = new Map<string, Post[]>();
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    grouped.set(year, [...(grouped.get(year) ?? []), post]);
  }

  return [...grouped]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([year, yearPosts]) => ({ year, posts: yearPosts }));
}

export function assertUniqueSlugs(posts: Post[]): void {
  const slugs = new Set<string>();
  for (const post of posts) {
    if (slugs.has(post.slug)) {
      throw new Error(`duplicate slug: ${post.slug}`);
    }
    slugs.add(post.slug);
  }
}

function parseMarkdown(file: string): matter.GrayMatterFile<string> {
  const source = readFileSync(file, "utf8");
  try {
    return matter(source, {
      engines: {
        yaml: {
          parse(source) {
            const data = loadYaml(source, { schema: JSON_SCHEMA });
            return data !== null && typeof data === "object" ? data : {};
          },
        },
      },
    });
  } catch (cause) {
    throw new Error(`${file}: invalid YAML frontmatter`, { cause });
  }
}

function assertValidPostSlug(slug: string, file: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `${file}: invalid post slug "${slug}" (use a lowercase ASCII kebab-case filename)`,
    );
  }
}

function createContentSignature(files: string[]): string {
  return files
    .map((file) => {
      const stats = statSync(file);
      return `${file}:${stats.mtimeMs}:${stats.size}`;
    })
    .join("|");
}
