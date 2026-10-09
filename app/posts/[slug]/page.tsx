import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarkdownContent } from "@/components/markdown-content";
import { formatPostDate } from "@/components/post-card";
import { PostAuthor } from "@/components/post-meta";
import { getAdjacentPosts, getPost, getPosts } from "@/lib/content";

import styles from "./page.module.css";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) notFound();

  const adjacent = getAdjacentPosts(slug);

  return (
    <article className={styles.article}>
      <a className={styles.back} href="/">
        ← 返回首页
      </a>

      <header className={styles.header}>
        <div className={styles.meta}>
          <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          {post.category ? <span>{post.category}</span> : null}
          <PostAuthor author={post.author} />
        </div>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
      </header>

      <MarkdownContent>{post.body}</MarkdownContent>

      {adjacent.previous || adjacent.next ? (
        <nav aria-label="相邻文章" className={styles.navigation}>
          {adjacent.previous ? (
            <a href={`/posts/${adjacent.previous.slug}/`}>
              <span>上一篇 · 较早</span>
              {adjacent.previous.title}
            </a>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <a href={`/posts/${adjacent.next.slug}/`}>
              <span>下一篇 · 较新</span>
              {adjacent.next.title}
            </a>
          ) : null}
        </nav>
      ) : null}
    </article>
  );
}
