import clsx from "clsx";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import styles from "./page-header.module.scss";

export function DashboardPageHeader({
  backHref,
  backLabel = "Back",
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx(styles.root, className)}>
      {backHref ? (
        <Link to={backHref} className={styles.backLink}>
          {backLabel}
        </Link>
      ) : null}
      <div className={styles.main}>
        <div className={styles.copy}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <div className={styles.description}>{description}</div> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
