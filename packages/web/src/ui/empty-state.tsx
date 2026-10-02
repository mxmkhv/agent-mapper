import type { ReactNode } from "react";

/** A view with nothing to show says what is empty and what would change that. */
export function EmptyState({
  title,
  children
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="col-span-full grid place-items-center p-16 text-center">
      <div>
        <h3 className="m-0 font-mono text-title">{title}</h3>
        {children ? (
          <p className="mt-2 mb-0 text-ink-muted">{children}</p>
        ) : null}
      </div>
    </div>
  );
}
