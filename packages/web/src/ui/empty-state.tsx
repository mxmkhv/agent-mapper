import type { ReactNode } from "react";

/** A view with nothing to show says what is empty and what would change that. */
export function EmptyState({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="col-span-full grid place-items-center p-16 text-center">
      <div>
        <h3 className="m-0 font-semibold">{title}</h3>
        <p className="mt-1 text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
