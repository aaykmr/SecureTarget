import clsx from "clsx";
import type { InputHTMLAttributes } from "react";
import styles from "./input.module.scss";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(styles.root, className)} {...props} />;
}
