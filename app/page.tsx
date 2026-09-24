import { PostCard } from "@/components/post-card";
import { getPosts } from "@/lib/content";

import styles from "./page.module.css";

export default function HomePage() {
  const posts = getPosts();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>NOTES ON CODE &amp; LIFE</p>
        <h1>最新文章</h1>
        <p className={styles.intro}>
          记录工程实践、产品判断，以及值得再往前想一步的日常。
        </p>
      </header>

      <section aria-label="文章列表" className={styles.grid}>
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </section>
    </div>
  );
}
