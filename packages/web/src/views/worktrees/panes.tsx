import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../../ui/button";

/** The scrolling list column; holds one or more list sections. */
export function ListPane({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-0 overflow-auto px-5 pt-3 pb-10">
      {children}
    </section>
  );
}

/** A heading with its count, then the rows in one card, matching Inventory groups. */
export function ListSection({
  title,
  count,
  detail,
  children
}: {
  title: string;
  count: number;
  /** Extra count shown after the main one, e.g. "278 files". */
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex h-[30px] items-center gap-2 px-2.5 text-label font-semibold text-ink-muted">
        {title}
        <span className="font-medium text-ink-faint tabular-nums">
          {count}
          {detail ? ` · ${detail}` : ""}
        </span>
      </div>
      <div className="overflow-hidden rounded-card border border-hairline bg-surface">
        {children}
      </div>
    </div>
  );
}

export function DetailPane({
  eyebrow,
  title,
  onClose,
  children
}: {
  eyebrow: string;
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label="Details"
      className="relative min-h-0 overflow-auto border-hairline bg-surface px-5 pt-4.5 pb-7 max-lg:border-t lg:border-l"
    >
      <Button
        aria-label="Close details"
        className="absolute top-3 right-3"
        onClick={onClose}
        variant="icon"
      >
        <X aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
      </Button>
      <div className="text-label text-ink-muted">{eyebrow}</div>
      <h2 className="mt-1.5 mb-1 pr-8 text-headline font-semibold tracking-tight break-words">
        {title}
      </h2>
      {children}
    </aside>
  );
}
