import type { Post } from "@/lib/content/types";

import styles from "./post-card.module.css";
import { PostAuthor } from "./post-meta";

interface PostCardProps {
  post: Post;
}

export function formatPostDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

export function PostCard({ post }: PostCardProps) {
  const href = `/posts/${post.slug}/`;

  return (
    <article className={styles.card}>
      <div className={styles.meta}>
        <time dateTime={post.date}>{formatPostDate(post.date)}</time>
        {post.category ? (
          <span className={styles.category}>{post.category}</span>
        ) : null}
        <PostAuthor author={post.author} />
      </div>
      <h2 className={styles.title}>
        <a href={href}>{post.title}</a>
      </h2>
      <p className={styles.excerpt}>{post.excerpt}</p>
      <a className={styles.readMore} href={href}>
        继续阅读
      </a>
    </article>
  );
}
