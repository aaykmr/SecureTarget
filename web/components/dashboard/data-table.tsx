import clsx from "clsx";
import type { ReactNode } from "react";
import styles from "./data-table.module.scss";

export function DataTable({
  children,
  className,
  caption,
}: {
  children: ReactNode;
  className?: string;
  caption?: string;
}) {
  return (
    <div className={clsx(styles.shell, className)}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          {caption ? <caption className={styles.caption}>{caption}</caption> : null}
          {children}
        </table>
      </div>
    </div>
  );
}

export function DataTableEmpty({
  children,
  colSpan,
}: {
  children: ReactNode;
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className={styles.empty}>
        {children}
      </td>
    </tr>
  );
}
