import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "写作后台",
  robots: { index: false, follow: false },
};

export default function WriteLayout({ children }: { children: ReactNode }) {
  return children;
}
