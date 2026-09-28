"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import styles from "@/app/write/write.module.css";
import { filterPostSummaries, type PostFilter } from "@/lib/write/admin-state";
import type { PostSummary } from "@/lib/write/types";

export function AdminShell({
  children,
  posts,
}: {
  children: React.ReactNode;
  posts: PostSummary[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PostFilter>("all");
  const filtered = useMemo(
    () => filterPostSummaries(posts, filter, query),
    [posts, filter, query],
  );

  async function logout() {
    await fetch("/api/write/logout", { method: "POST" });
    router.replace("/write/login");
    router.refresh();
  }

  return (
    <div className={styles.admin}>
      <aside className={styles.sidebar}>
        <header className={styles.brand}>
          <div>
            <p>VIC LOG</p>
            <h1>写作台</h1>
          </div>
          <button className={styles.textButton} onClick={logout} type="button">
            退出
          </button>
        </header>
        <Link className={styles.newButton} href="/write/new">
          ＋ 新建文章
        </Link>
        <input
          aria-label="搜索文章"
          className={styles.search}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题、slug 或摘要"
          type="search"
          value={query}
        />
        <div className={styles.filters}>
          {(["all", "published", "draft"] as const).map((value) => (
            <button
              aria-pressed={filter === value}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {{ all: "全部", published: "已发布", draft: "草稿" }[value]}
            </button>
          ))}
        </div>
        <nav aria-label="文章管理列表" className={styles.postList}>
          {filtered.map((post) => {
            const href = `/write/${post.slug}`;
            return (
              <Link className={pathname === href ? styles.activePost : ""} href={href} key={post.slug}>
                <span>{post.title}</span>
                <small>
                  {post.date} · {post.published ? "已发布" : "草稿"}
                </small>
              </Link>
            );
          })}
          {filtered.length === 0 ? <p className={styles.emptyList}>没有匹配的文章</p> : null}
        </nav>
        <a className={styles.blogLink} href="/">
          查看博客 ↗
        </a>
      </aside>
      <section className={styles.workspace}>{children}</section>
    </div>
  );
}
