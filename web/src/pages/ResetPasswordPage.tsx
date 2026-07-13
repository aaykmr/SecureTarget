import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Link, useSearchParams } from "react-router-dom";
import { HugeIcon } from "@/components/huge-icon";
import { ResetPasswordForm } from "./ResetPasswordForm";
import styles from "./ResetPasswordPage.module.scss";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className={styles.root}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <HugeIcon icon={Analytics01Icon} size={20} />
        </span>
        SecureTarget
      </Link>
      <div className={styles.intro}>
        <h1 className={styles.title}>Reset password</h1>
        <p className={styles.subtitle}>Choose a new password for your account.</p>
      </div>
      <ResetPasswordForm token={token} />
      <p className={styles.footer}>
        <Link to="/login" className={styles.footerLink}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
