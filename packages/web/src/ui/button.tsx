import type { ComponentProps } from "react";

/** Disabled primary gets its own quiet colours: 50% ink would read as a bright slab in dark mode. Hover on primary is an accent inset, since ink cannot get darker. */
const variants = {
  primary:
    "border-ink bg-ink px-2.5 text-canvas enabled:hover:shadow-[inset_0_0_0_2px_var(--am-accent)] disabled:border-hairline disabled:bg-wash disabled:text-ink-faint",
  secondary:
    "border-ink bg-surface px-2.5 text-ink enabled:hover:bg-wash disabled:border-hairline disabled:text-ink-faint",
  icon: "w-7 justify-center border-ink bg-surface text-ink enabled:hover:bg-wash disabled:border-hairline disabled:text-ink-faint",
  /** The same three on an accent fill, such as a selected row. */
  accentPrimary:
    "border-on-accent bg-on-accent px-2.5 text-accent enabled:hover:opacity-90",
  accentSecondary:
    "border-on-accent px-2.5 text-on-accent enabled:hover:bg-on-accent/15",
  accentIcon:
    "w-7 justify-center border-on-accent text-on-accent enabled:hover:bg-on-accent/15"
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
      className={`inline-flex h-7 items-center gap-2 border text-label font-semibold whitespace-nowrap disabled:cursor-default ${variants[variant]} ${className}`}
    />
  );
}
