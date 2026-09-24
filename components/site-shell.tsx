import type { ReactNode } from "react";

import { getSite } from "@/lib/content";

import { AuthorSidebar } from "./author-sidebar";
import styles from "./site-shell.module.css";

interface SiteShellProps {
  children: ReactNode;
}

export function SiteShell({ children }: SiteShellProps) {
  const site = getSite();

  return (
    <div className={styles.shell}>
      <AuthorSidebar site={site} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
