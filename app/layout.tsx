import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteShell } from "@/components/site-shell";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vic Log",
    template: "%s | Vic Log",
  },
  description: "Meng Weifei 的个人博客",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
