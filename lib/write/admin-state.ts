import type { PostSummary } from "./types";

export type PostFilter = "all" | "published" | "draft";

export function filterPostSummaries(
  posts: PostSummary[],
  filter: PostFilter,
  query: string,
): PostSummary[] {
  const needle = query.trim().toLocaleLowerCase();
  return posts.filter((post) => {
    if (filter === "published" && !post.published) return false;
    if (filter === "draft" && post.published) return false;
    if (!needle) return true;
    return [post.title, post.slug, post.excerpt, post.category]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle);
  });
}
