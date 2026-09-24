import styles from "./page.module.css";

export default function NotFound() {
  return (
    <section className={styles.header}>
      <p className={styles.eyebrow}>404</p>
      <h1>这里没有这篇文章。</h1>
      <p className={styles.intro}>
        <a href="/">返回首页</a>
      </p>
    </section>
  );
}
