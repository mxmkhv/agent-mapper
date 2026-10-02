import type { ReactNode } from "react";
import { Button } from "../../ui/button";
import { PixelIcon } from "../../ui/pixel-icon";

/** The scrolling list column; holds one or more list sections. */
export function ListPane({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-0 overflow-auto px-5 pt-3 pb-10">
      {children}
    </section>
  );
}

/** An ink tab with the title and its count, then the rows in one ruled box, matching Inventory groups. */
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
    <div className="mb-3.5 border-2 border-rule">
      <div className="flex h-[26px] items-stretch border-b-2 border-rule">
        <span className="flex min-w-0 items-center gap-2 bg-ink pr-3 pl-2.5 font-mono text-mono text-canvas">
          <span className="truncate">{title}</span>
          {count}
        </span>
        {detail ? (
          <span className="flex items-center px-3 font-mono text-mono whitespace-nowrap text-ink-muted">
            {detail}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className="dots-light min-w-6 flex-1 bg-ink [mask-position:0_1px]"
        />
      </div>
      {children}
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
      className="relative min-h-0 overflow-auto border-rule bg-surface px-5 pt-4.5 pb-7 max-lg:border-t-2 lg:border-l-2"
    >
      <Button
        aria-label="Close details"
        className="absolute top-3 right-3"
        onClick={onClose}
        variant="icon"
      >
        <PixelIcon name="close" />
      </Button>
      <div className="text-label text-ink-muted">{eyebrow}</div>
      <h2 className="mt-1.5 mb-1 pr-8 font-mono text-headline break-words">
        {title}
      </h2>
      {children}
    </aside>
  );
}
