import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-info";

import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.lede}>{APP_DESCRIPTION}</p>

        <section className={styles.status}>
          <h2 className={styles.statusLabel}>Status</h2>
          <p className={styles.statusText}>
            Walking skeleton. The editor and card generator are not built yet —
            see <code>SPEC.md</code> in the repository for the specification and
            the build plan.
          </p>
        </section>
      </main>
    </div>
  );
}
