import { AdminShell } from "@/components/write/admin-shell";
import { getWriteRuntime } from "@/lib/write/server";

import styles from "../write.module.css";

export default async function WriteHomePage() {
  const posts = await getWriteRuntime().store.list();
  return (
    <AdminShell posts={posts}>
      <div className={styles.welcome}>
        <p className={styles.eyebrow}>LOCAL MARKDOWN STUDIO</p>
        <h2>选择一篇文章继续写作</h2>
        <p>也可以新建草稿。每次保存只会提交对应的 Markdown 文件。</p>
      </div>
    </AdminShell>
  );
}
