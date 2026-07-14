import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Link } from "react-router-dom";
import { HugeIcon } from "@/components/huge-icon";
import { RegisterForm } from "./RegisterForm";
import styles from "./RegisterPage.module.scss";

/** Hidden bootstrap route — not linked from the product UI. */
export function SignUpInternalPage() {
  return (
    <div className={styles.root}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <HugeIcon icon={Analytics01Icon} size={20} />
        </span>
        EventIQN
      </Link>
      <div className={styles.intro}>
        <h1 className={styles.title}>Internal signup</h1>
        <p className={styles.subtitle}>Allowlisted global admin bootstrap only.</p>
      </div>
      <RegisterForm mode="internal" />
      <p className={styles.footer}>
        Already have an account?{" "}
        <Link to="/login" className={styles.footerLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
