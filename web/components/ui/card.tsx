import clsx from "clsx";
import type { HTMLAttributes } from "react";
import styles from "./card.module.scss";

export type CardVariant = "default" | "elevated" | "interactive";

export function Card({
  className,
  variant = "default",
  compact,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        styles.root,
        variant === "elevated" && styles.elevated,
        variant === "interactive" && styles.interactive,
        compact && styles.compact,
        className,
      )}
      {...props}
    />
  );
}
