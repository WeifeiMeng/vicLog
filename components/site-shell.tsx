import type { ReactNode } from "react";

import { getSite } from "@/lib/content";

import { AuthorSidebar } from "./author-sidebar";
import { PathAwareShell } from "./path-aware-shell";

interface SiteShellProps {
  children: ReactNode;
}

export function SiteShell({ children }: SiteShellProps) {
  const site = getSite();

  return (
    <PathAwareShell sidebar={<AuthorSidebar site={site} />}>
      {children}
    </PathAwareShell>
  );
}
