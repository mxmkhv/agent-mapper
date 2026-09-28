import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "border-ink bg-ink px-2.5 text-canvas hover:opacity-90",
  secondary:
    "border-hairline bg-surface px-2.5 text-ink hover:border-hairline-strong",
  icon: "w-7 justify-center border-hairline bg-surface text-ink hover:border-hairline-strong"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
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
      className={`inline-flex h-7 items-center gap-1.5 rounded-button border text-label font-semibold whitespace-nowrap disabled:cursor-default disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}
