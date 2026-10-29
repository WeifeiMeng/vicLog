import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

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
      <ReactMarkdown
        components={{ a: MarkdownLink }}
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
