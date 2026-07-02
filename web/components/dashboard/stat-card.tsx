import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./stat-card.module.scss";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "brand";
  className?: string;
}) {
  return (
    <article className={clsx(styles.root, styles[tone], className)}>
      <div className={styles.top}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        <span className={styles.label}>{label}</span>
      </div>
      <p className={styles.value}>{value}</p>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </article>
  );
}
