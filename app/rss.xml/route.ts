import { getPosts, getSite } from "@/lib/content";
import { createRssFeed } from "@/lib/rss";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(createRssFeed(getSite(), getPosts(), siteUrl), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
