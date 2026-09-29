import type { ReactNode } from "react";

/** The worktree views bring their own list and detail columns, matching Inventory and the inspector. */
export function ListPane({
  title,
  count,
  children
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="min-h-0 overflow-auto px-5 pt-3 pb-10">
      <div className="flex h-[30px] items-center gap-2 px-2.5 text-label font-semibold text-ink-muted">
        {title}
        <span className="font-medium text-ink-faint tabular-nums">{count}</span>
      </div>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface">
        {children}
      </div>
    </section>
  );
}

export function DetailPane({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label="Details"
      className="min-h-0 overflow-auto border-l border-hairline bg-surface px-5 pt-4.5 pb-7"
    >
      <div className="text-label text-ink-muted">{eyebrow}</div>
      <h2 className="mt-1.5 mb-1 text-headline font-semibold tracking-tight break-words">
        {title}
      </h2>
      {children}
    </aside>
  );
}

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
