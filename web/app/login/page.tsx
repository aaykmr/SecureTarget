import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import styles from "./page.module.scss";

export default function LoginPage() {
  return (
    <div className={styles.root}>
      <div className={styles.intro}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Access your SecureTarget dashboard and API keys.</p>
      </div>
      <Suspense fallback={<p className={styles.fallback}>Loading…</p>}>
        <LoginForm />
      </Suspense>
      <p className={styles.footer}>
        No account?{" "}
        <Link href="/register" className={styles.footerLink}>
          Register
        </Link>
      </p>
    </div>
  );
}
