"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import styles from "@/app/write/write.module.css";
import { MarkdownContent } from "@/components/markdown-content";
import type { EditablePost, PostInput } from "@/lib/write/types";

type EditorMode = "edit" | "preview" | "split";

export function PostEditor({ initial }: { initial: EditablePost | PostInput }) {
  const router = useRouter();
  const [form, setForm] = useState<PostInput>(() => stripVersion(initial));
  const [saved, setSaved] = useState<PostInput>(() => stripVersion(initial));
  const [version, setVersion] = useState("version" in initial ? initial.version : "");
  const [mode, setMode] = useState<EditorMode>("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isNew = !("version" in initial);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof PostInput>(key: K, value: PostInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        isNew ? "/api/write/posts" : `/api/write/posts/${initial.slug}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isNew ? form : { input: form, version }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "保存失败");
      const post = result.data as EditablePost;
      setVersion(post.version);
      setSaved(stripVersion(post));
      setForm(stripVersion(post));
      setMessage("已保存，并创建本地 Git 提交");
      if (isNew || post.slug !== initial.slug) router.replace(`/write/${post.slug}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (isNew || !window.confirm(`确定删除《${form.title || form.slug}》吗？删除会记录到 Git。`)) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/write/posts/${initial.slug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "删除失败");
      router.replace("/write");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
      setPending(false);
    }
  }

  return (
    <form className={styles.editor} onSubmit={save}>
      <header className={styles.editorHeader}>
        <div>
          <p className={styles.eyebrow}>{isNew ? "NEW NOTE" : form.published ? "PUBLISHED" : "DRAFT"}</p>
          <h2>{isNew ? "新建文章" : form.title || "未命名文章"}</h2>
        </div>
        <div className={styles.actions}>
          {!isNew ? (
            <button className={styles.deleteButton} disabled={pending} onClick={remove} type="button">
              删除
            </button>
          ) : null}
          <button disabled={pending || !dirty} type="submit">
            {pending ? "保存中…" : "保存并提交 Git"}
          </button>
        </div>
      </header>

      {message ? <p className={styles.success}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.metadataGrid}>
        <label>
          <span>标题</span>
          <input onChange={(e) => set("title", e.target.value)} required value={form.title} />
        </label>
        <label>
          <span>Slug</span>
          <input onChange={(e) => set("slug", e.target.value)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required value={form.slug} />
        </label>
        <label>
          <span>日期</span>
          <input onChange={(e) => set("date", e.target.value)} required type="date" value={form.date} />
        </label>
        <label>
          <span>作者</span>
          <input
            list="post-author-suggestions"
            name="author"
            onChange={(event) => set("author", event.target.value)}
            required
            value={form.author}
          />
          <datalist id="post-author-suggestions">
            <option value="Vic" />
            <option value="Vic Agent" />
          </datalist>
        </label>
        <label>
          <span>分类</span>
          <input onChange={(e) => set("category", e.target.value)} value={form.category} />
        </label>
        <label className={styles.fullField}>
          <span>摘要</span>
          <textarea onChange={(e) => set("excerpt", e.target.value)} required rows={2} value={form.excerpt} />
        </label>
        <label className={styles.publishField}>
          <input checked={form.published} onChange={(e) => set("published", e.target.checked)} type="checkbox" />
          <span>发布到博客、归档和 RSS</span>
        </label>
      </div>

      <div className={styles.modeBar}>
        <span>正文</span>
        <div>
          {(["edit", "preview", "split"] as const).map((value) => (
            <button aria-pressed={mode === value} key={value} onClick={() => setMode(value)} type="button">
              {{ edit: "编辑", preview: "预览", split: "分栏" }[value]}
            </button>
          ))}
        </div>
      </div>
      <div className={`${styles.contentEditor} ${mode === "split" ? styles.split : ""}`}>
        {mode !== "preview" ? (
          <textarea
            aria-label="Markdown 正文"
            className={styles.bodyInput}
            onChange={(e) => set("body", e.target.value)}
            placeholder="从这里开始写 Markdown…"
            value={form.body}
          />
        ) : null}
        {mode !== "edit" ? (
          <div className={styles.preview}>
            <MarkdownContent>{form.body || "_还没有正文_"}</MarkdownContent>
          </div>
        ) : null}
      </div>
    </form>
  );
}

function stripVersion(post: EditablePost | PostInput): PostInput {
  const { slug, title, author, date, category, excerpt, published, body } = post;
  return { slug, title, author, date, category, excerpt, published, body };
}
