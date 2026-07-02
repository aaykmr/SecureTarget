"use client";

import clsx from "clsx";
import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { Error } from "@/components/ui/error";
import fieldStyles from "./field.module.scss";
import { inputSizes, type InputSize } from "./input";

const controlSizeClass: Record<InputSize, string> = {
  xSmall: fieldStyles.controlXSmall,
  small: fieldStyles.controlSmall,
  mediumSmall: fieldStyles.controlMediumSmall,
  medium: fieldStyles.controlMedium,
  large: fieldStyles.controlLarge,
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  size?: InputSize;
  error?: string | boolean;
  label?: string;
  wrapperClassName?: string;
  children: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    size = "medium",
    disabled = false,
    error,
    label,
    className,
    wrapperClassName,
    id,
    children,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hasError = Boolean(error);

  return (
    <div className={fieldStyles.root}>
      {label ? (
        <label htmlFor={selectId} className={fieldStyles.label}>
          {label}
        </label>
      ) : null}
      <div
        className={clsx(
          fieldStyles.wrapper,
          fieldStyles[inputSizes[size]],
          hasError && fieldStyles.wrapperError,
          disabled && fieldStyles.wrapperDisabled,
          wrapperClassName,
        )}
      >
        <select
          {...rest}
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={clsx(
            fieldStyles.control,
            fieldStyles.select,
            controlSizeClass[size],
            className,
          )}
        >
          {children}
        </select>
      </div>
      {typeof error === "string" ? <Error size={size === "large" ? "large" : "small"}>{error}</Error> : null}
    </div>
  );
});
