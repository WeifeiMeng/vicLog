import type { Metadata } from "next";

import { formatPostDate } from "@/components/post-card";
import { getPosts, groupPostsByYear } from "@/lib/content";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "归档",
};

export default function ArchivePage() {
  const groups = groupPostsByYear(getPosts());

  return (
    <div className={styles.archive}>
      <header className={styles.header}>
        <p>ALL NOTES</p>
        <h1>归档</h1>
      </header>

      {groups.map(({ year, posts }) => (
        <section className={styles.year} key={year}>
          <h2>{year}</h2>
          <ol>
            {posts.map((post) => (
              <li key={post.slug}>
                <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                <a href={`/posts/${post.slug}/`}>{post.title}</a>
                {post.category ? <span>{post.category}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
