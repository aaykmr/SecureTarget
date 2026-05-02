import Link from "next/link";
import { RegisterForm } from "./register-form";
import styles from "./page.module.scss";

export default function RegisterPage() {
  return (
    <div className={styles.root}>
      <div className={styles.intro}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Register to create projects and API keys.</p>
      </div>
      <RegisterForm />
      <p className={styles.footer}>
        Already have an account?{" "}
        <Link href="/login" className={styles.footerLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
