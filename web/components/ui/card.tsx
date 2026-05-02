import clsx from "clsx";
import type { HTMLAttributes } from "react";
import styles from "./card.module.scss";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx(styles.root, className)} {...props} />;
}
