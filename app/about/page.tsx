import type { Metadata } from "next";

import { MarkdownContent } from "@/components/markdown-content";
import { getSite } from "@/lib/content";

export const metadata: Metadata = {
  title: "关于",
};

export default function AboutPage() {
  const site = getSite();

  return (
    <article>
      <h1>关于</h1>
      <MarkdownContent>{site.body}</MarkdownContent>
    </article>
  );
}
