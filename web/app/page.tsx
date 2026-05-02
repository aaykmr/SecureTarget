import Link from "next/link";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>SecureTarget</h1>
      <p className={styles.lead}>
        Dashboard for projects and API keys. Run the ingest backend separately to receive SDK events.
      </p>
      <div className={styles.actions}>
        <Link href="/login" className={styles.btnPrimary}>
          Sign in
        </Link>
        <Link href="/register" className={styles.btnSecondary}>
          Register
        </Link>
      </div>
    </div>
  );
}
