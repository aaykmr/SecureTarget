import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.scss";

export type ButtonVariant = "primary" | "secondary" | "outlined" | "ghost";

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  outlined: styles.outlined,
  ghost: styles.ghost
};

export function Button({
  variant = "primary",
  type = "button",
  fullWidth,
  alignSelfStart,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  alignSelfStart?: boolean;
}) {
  return (
    <button
      type={type}
      className={clsx(
        styles.root,
        variantClass[variant],
        fullWidth && styles.fullWidth,
        alignSelfStart && styles.selfStart,
        className
      )}
      {...props}
    />
  );
}
