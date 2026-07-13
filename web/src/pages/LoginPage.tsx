import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { Link, useSearchParams } from "react-router-dom";
import { HugeIcon } from "@/components/huge-icon";
import { LoginForm } from "./LoginForm";
import styles from "./LoginPage.module.scss";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const registered = searchParams.get("registered");
  const reset = searchParams.get("reset");

  return (
    <div className={styles.root}>
      <Link to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <HugeIcon icon={Analytics01Icon} size={20} />
        </span>
        EventIQN
      </Link>
      <div className={styles.intro}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Access your EventIQN dashboard and API keys.</p>
      </div>
      <LoginForm registered={Boolean(registered)} reset={Boolean(reset)} />
      <p className={styles.footer}>
        No account?{" "}
        <Link to="/register" className={styles.footerLink}>
          Register
        </Link>
      </p>
    </div>
  );
}
