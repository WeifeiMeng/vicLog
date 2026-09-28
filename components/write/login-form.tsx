"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import styles from "@/app/write/write.module.css";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/write/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "登录失败");
      router.replace("/write");
      router.refresh();
    } catch (cause) {
      setPassword("");
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.loginForm} onSubmit={submit}>
      <label htmlFor="write-password">密码</label>
      <input
        autoComplete="current-password"
        autoFocus
        id="write-password"
        onChange={(event) => setPassword(event.target.value)}
        required
        type="password"
        value={password}
      />
      {error ? <p className={styles.error}>{error}</p> : null}
      <button disabled={pending} type="submit">
        {pending ? "正在验证…" : "进入写作后台"}
      </button>
    </form>
  );
}
