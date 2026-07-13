import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from "@hugeicons/react";

export type { IconSvgElement };

export type HugeIconProps = {
  icon: IconSvgElement;
  className?: string;
} & Omit<HugeiconsIconProps, "icon">;

/** Shared Hugeicons renderer — use icons from `@hugeicons/core-free-icons` only. */
export function HugeIcon({ icon, className, size = 20, color = "currentColor", strokeWidth = 1.75, ...props }: HugeIconProps) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={props["aria-label"] ? undefined : true}
      {...props}
    />
  );
}
