import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./markdown-content.module.css";

interface MarkdownContentProps {
  children: string;
}

function MarkdownLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  const isExternal = /^https?:\/\//i.test(href);

  return (
    <a
      {...props}
      href={href}
      {...(isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
    />
  );
}

export function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <div className={styles.content}>
      <ReactMarkdown components={{ a: MarkdownLink }} remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
