import clsx from "clsx";
import styles from "./error.module.scss";

export type ErrorSize = "small" | "large";

export function Error({
  children,
  size = "small",
  className,
}: {
  children: React.ReactNode;
  size?: ErrorSize;
  className?: string;
}) {
  return <p className={clsx(styles.root, styles[size], className)}>{children}</p>;
}
