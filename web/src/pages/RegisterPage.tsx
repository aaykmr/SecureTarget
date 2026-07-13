import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Link } from "react-router-dom";
import { HugeIcon } from "@/components/huge-icon";
import { RegisterForm } from "./RegisterForm";
import styles from "./RegisterPage.module.scss";

export function RegisterPage() {
  return (
    <div className={styles.root}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <HugeIcon icon={Analytics01Icon} size={20} />
        </span>
        SecureTarget
      </Link>
      <div className={styles.intro}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Register to create projects and API keys.</p>
      </div>
      <RegisterForm />
      <p className={styles.footer}>
        Already have an account?{" "}
        <Link to="/login" className={styles.footerLink}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
