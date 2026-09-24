import { statSync } from "node:fs";
import path from "node:path";
import Link from "next/link";

import type { SiteContent } from "@/lib/content/types";

import styles from "./author-sidebar.module.css";

interface AuthorSidebarProps {
  site: SiteContent;
}

const navigation = [
  { href: "/", label: "首页" },
  { href: "/about/", label: "关于" },
  { href: "/archive/", label: "归档" },
  { href: "/rss.xml", label: "RSS" },
] as const;

export function AuthorSidebar({ site }: AuthorSidebarProps) {
  const hasAvatar = isPublicFile(site.avatar);

  return (
    <aside className={styles.sidebar}>
      <header className={styles.profile}>
        {hasAvatar ? (
          <img
            className={styles.avatar}
            src={site.avatar}
            alt={`${site.author} 的头像`}
            width={96}
            height={96}
          />
        ) : (
          <span
            className={styles.avatarFallback}
            role="img"
            aria-label={`${site.author} 的头像占位符`}
          >
            MW
          </span>
        )}
        <div className={styles.identity}>
          <Link className={styles.siteName} href="/">
            {site.name.toUpperCase()}
          </Link>
          <p className={styles.author}>{site.author}</p>
          <p className={styles.tagline}>
            {site.tagline.trim() || "简介稍后补充"}
          </p>
        </div>
      </header>

      <nav aria-label="主导航">
        <ul className={styles.navigation}>
          {navigation.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function isPublicFile(source: string | undefined): boolean {
  if (!source?.startsWith("/")) return false;

  const publicRoot = path.resolve(process.cwd(), "public");
  const sourcePath = source.split(/[?#]/, 1)[0];
  const candidate = path.resolve(publicRoot, `.${sourcePath}`);
  if (!candidate.startsWith(`${publicRoot}${path.sep}`)) return false;

  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}
