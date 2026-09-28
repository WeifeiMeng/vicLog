"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import styles from "./site-shell.module.css";

export function PathAwareShell({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/write")) {
    return <main className={styles.adminMain}>{children}</main>;
  }
  return (
    <div className={styles.shell}>
      {sidebar}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
