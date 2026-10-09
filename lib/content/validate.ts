import type { PostFrontmatter, SiteFrontmatter } from "./types";

export function validateSite(
  data: Record<string, unknown>,
  file: string,
): SiteFrontmatter {
  if (typeof data.name !== "string" || data.name.trim() === "") {
    throw new Error(`${file}: invalid or missing name`);
  }
  if (typeof data.author !== "string" || data.author.trim() === "") {
    throw new Error(`${file}: invalid or missing author`);
  }
  if (typeof data.tagline !== "string") {
    throw new Error(`${file}: invalid or missing tagline`);
  }
  for (const field of ["avatar", "email", "github"] as const) {
    if (data[field] !== undefined && typeof data[field] !== "string") {
      throw new Error(`${file}: invalid or missing ${field}`);
    }
  }

  return {
    name: data.name,
    author: data.author,
    tagline: data.tagline,
    ...(data.avatar !== undefined ? { avatar: data.avatar as string } : {}),
    ...(data.email !== undefined ? { email: data.email as string } : {}),
    ...(data.github !== undefined ? { github: data.github as string } : {}),
  };
}

export function validatePost(
  data: Record<string, unknown>,
  file: string,
): PostFrontmatter {
  if (typeof data.title !== "string" || data.title.trim() === "") {
    throw new Error(`${file}: invalid or missing title`);
  }
  if (typeof data.author !== "string" || data.author.trim() === "") {
    throw new Error(`${file}: invalid or missing author`);
  }
  if (typeof data.date !== "string" || !isCalendarDate(data.date)) {
    throw new Error(`${file}: invalid or missing date`);
  }
  if (typeof data.excerpt !== "string" || data.excerpt.trim() === "") {
    throw new Error(`${file}: invalid or missing excerpt`);
  }
  if (typeof data.published !== "boolean") {
    throw new Error(`${file}: invalid or missing published`);
  }
  if (data.category !== undefined && typeof data.category !== "string") {
    throw new Error(`${file}: invalid or missing category`);
  }

  return {
    title: data.title,
    author: data.author.trim(),
    date: data.date,
    ...(data.category !== undefined ? { category: data.category as string } : {}),
    excerpt: data.excerpt,
    published: data.published,
  };
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
