import type { Post, SiteContent } from "./content/types";

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };

    return entities[character];
  });
}

export function createRssFeed(
  site: SiteContent,
  posts: Post[],
  baseUrl: string,
): string {
  const description = site.tagline || `${site.author} 的个人博客`;
  const items = posts
    .map((post) => {
      const link = `${baseUrl}/posts/${post.slug}/`;

      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        `      <pubDate>${new Date(`${post.date}T00:00:00.000Z`).toUTCString()}</pubDate>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(site.name)}</title>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <link>${escapeXml(baseUrl)}</link>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
