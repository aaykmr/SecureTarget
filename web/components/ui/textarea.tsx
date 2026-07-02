"use client";

import clsx from "clsx";
import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
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

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> & {
  size?: InputSize;
  error?: string | boolean;
  label?: string;
  wrapperClassName?: string;
  mono?: boolean;
  onValueChange?: (value: string) => void;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    size = "medium",
    disabled = false,
    error,
    label,
    className,
    wrapperClassName,
    id,
    mono = false,
    onChange,
    onValueChange,
    rows = 3,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const hasError = Boolean(error);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange?.(e);
    onValueChange?.(e.target.value);
  }

  return (
    <div className={fieldStyles.root}>
      {label ? (
        <label htmlFor={textareaId} className={fieldStyles.label}>
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
        <textarea
          {...rest}
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          onChange={handleChange}
          className={clsx(
            fieldStyles.control,
            fieldStyles.textarea,
            controlSizeClass[size],
            mono && fieldStyles.controlMono,
            className,
          )}
        />
      </div>
      {typeof error === "string" ? <Error size={size === "large" ? "large" : "small"}>{error}</Error> : null}
    </div>
  );
});
