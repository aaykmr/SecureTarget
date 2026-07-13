import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Link } from "react-router-dom";
import { HugeIcon } from "@/components/huge-icon";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import styles from "./ForgotPasswordPage.module.scss";

export function ForgotPasswordPage() {
  return (
    <div className={styles.root}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <HugeIcon icon={Analytics01Icon} size={20} />
        </span>
        SecureTarget
      </Link>
      <div className={styles.intro}>
        <h1 className={styles.title}>Forgot password</h1>
        <p className={styles.subtitle}>Enter your email and we&apos;ll send a reset link if an account exists.</p>
      </div>
      <ForgotPasswordForm />
      <p className={styles.footer}>
        Remember your password?{" "}
        <Link to="/login" className={styles.footerLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
