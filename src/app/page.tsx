import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-info";

import styles from "./page.module.css";
import { Studio } from "./studio";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>{APP_NAME}</h1>
        <p className={styles.lede}>{APP_DESCRIPTION}</p>

        <Studio />
      </main>
    </div>
  );
}
