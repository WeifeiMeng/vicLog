import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/write/login-form";
import { SESSION_COOKIE, verifySession } from "@/lib/write/auth";
import { loadWriteConfig } from "@/lib/write/config";

import styles from "../write.module.css";

export const dynamic = "force-dynamic";

export default async function WriteLoginPage() {
  try {
    const config = loadWriteConfig();
    const cookieStore = await cookies();
    if (verifySession(cookieStore.get(SESSION_COOKIE)?.value, config.sessionSecret)) {
      redirect("/write");
    }
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
  }

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <p className={styles.eyebrow}>VIC LOG · PRIVATE</p>
        <h1>写作后台</h1>
        <p>输入本地配置的写作密码，继续管理 Markdown 文章。</p>
        <LoginForm />
        <a className={styles.backLink} href="/">
          ← 返回博客
        </a>
      </div>
    </div>
  );
}
