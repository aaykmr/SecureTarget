"use client";

import clsx from "clsx";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Error } from "@/components/ui/error";
import fieldStyles from "./field.module.scss";

export const inputSizes = {
  xSmall: "sizeXSmall",
  small: "sizeSmall",
  mediumSmall: "sizeMediumSmall",
  medium: "sizeMedium",
  large: "sizeLarge",
} as const;

export type InputSize = keyof typeof inputSizes;

const controlSizeClass: Record<InputSize, string> = {
  xSmall: fieldStyles.controlXSmall,
  small: fieldStyles.controlSmall,
  mediumSmall: fieldStyles.controlMediumSmall,
  medium: fieldStyles.controlMedium,
  large: fieldStyles.controlLarge,
};

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> & {
  size?: InputSize;
  prefix?: ReactNode;
  suffix?: ReactNode;
  prefixStyling?: boolean | string;
  suffixStyling?: boolean | string;
  error?: string | boolean;
  label?: string;
  wrapperClassName?: string;
  mono?: boolean;
  onValueChange?: (value: string) => void;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    placeholder,
    size = "medium",
    prefix,
    suffix,
    prefixStyling = true,
    suffixStyling = true,
    disabled = false,
    error,
    label,
    value,
    defaultValue,
    onChange,
    onValueChange,
    onFocus,
    onBlur,
    className,
    wrapperClassName,
    id,
    mono = false,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const hasError = Boolean(error);
  const isLarge = size === "large";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e);
    onValueChange?.(e.target.value);
  }

  function affixClass(styled: boolean | string, side: "prefix" | "suffix") {
    const rounded =
      side === "prefix"
        ? isLarge
          ? fieldStyles.roundedLeftLg
          : fieldStyles.roundedLeftMd
        : isLarge
          ? fieldStyles.roundedRightLg
          : fieldStyles.roundedRightMd;

    if (styled === true) {
      return clsx(
        fieldStyles.affix,
        fieldStyles.affixStyled,
        side === "prefix" ? fieldStyles.prefixStyled : fieldStyles.suffixStyled,
        rounded,
      );
    }
    if (typeof styled === "string") {
      return clsx(fieldStyles.affix, styled, rounded);
    }
    return clsx(fieldStyles.affix, side === "prefix" ? fieldStyles.prefixPlain : fieldStyles.suffixPlain, rounded);
  }

  return (
    <div
      className={fieldStyles.root}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus();
        }
      }}
    >
      {label ? (
        <label htmlFor={inputId} className={fieldStyles.label}>
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
        {prefix ? <div className={affixClass(prefixStyling, "prefix")}>{prefix}</div> : null}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          className={clsx(
            fieldStyles.control,
            controlSizeClass[size],
            mono && fieldStyles.controlMono,
            className,
          )}
          placeholder={placeholder}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {suffix ? <div className={affixClass(suffixStyling, "suffix")}>{suffix}</div> : null}
      </div>
      {typeof error === "string" ? <Error size={size === "large" ? "large" : "small"}>{error}</Error> : null}
    </div>
  );
});
