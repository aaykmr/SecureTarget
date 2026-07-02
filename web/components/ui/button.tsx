import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.scss";

export type ButtonVariant = "primary" | "secondary" | "outlined" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  outlined: styles.outlined,
  ghost: styles.ghost,
  danger: styles.danger,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  fullWidth,
  alignSelfStart,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  alignSelfStart?: boolean;
}) {
  return (
    <button
      type={type}
      className={clsx(
        styles.root,
        variantClass[variant],
        sizeClass[size],
        fullWidth && styles.fullWidth,
        alignSelfStart && styles.selfStart,
        className
      )}
      {...props}
    />
  );
}
