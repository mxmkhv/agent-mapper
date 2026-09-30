import type { ComponentProps } from "react";

/** Disabled primary gets its own quiet colours: faded ink turns into a bright slab in dark mode. */
const variants = {
  primary:
    "border-ink bg-ink px-2.5 text-canvas enabled:hover:opacity-90 disabled:border-hairline disabled:bg-wash disabled:text-ink-faint",
  secondary:
    "border-hairline bg-surface px-2.5 text-ink hover:border-hairline-strong disabled:opacity-50",
  icon: "w-7 justify-center border-hairline bg-surface text-ink hover:border-hairline-strong disabled:opacity-50"
};

type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-7 items-center gap-1.5 rounded-button border text-label font-semibold whitespace-nowrap disabled:cursor-default ${variants[variant]} ${className}`}
    />
  );
}
