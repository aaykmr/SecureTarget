import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./panel.module.scss";

export function DashboardPanel({
  title,
  lead,
  children,
  className,
  noPadding,
}: {
  title?: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section className={clsx(styles.root, noPadding && styles.noPadding, className)}>
      {title || lead ? (
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          {lead ? <div className={styles.lead}>{lead}</div> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
