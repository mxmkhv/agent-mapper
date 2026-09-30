import type { ReactNode } from "react";
import type { InstructionImport } from "@agent-mapper/core";
import { ArrowRight, Link2 } from "lucide-react";
import { layerLabel } from "../model/layers";
import { shortPath, tildePath, type PathContext } from "../model/paths";
import type { InventoryRecord, RecordKind } from "../model/record-types";
import { kindLabel } from "../ui/kind-icon";
import { ToolGlyph } from "../ui/marks";
import { PathText } from "../ui/path-text";

/** Same approximation the core context estimate uses. */
const charactersPerToken = 4;

export function Section({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5">
      <h3 className="m-0 mb-2 text-caption font-semibold text-ink-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Where a record sits in the stack: layer › plugin › file › declaration. */
export function Provenance({
  record,
  context,
  onSelect
}: {
  record: InventoryRecord;
  context: PathContext;
  onSelect(id: string): void;
}) {
  if (record.kind === "plugin") {
    const { marketplace } = record;
    return (
      <div className="mt-4 flex flex-wrap items-center gap-1 rounded-panel bg-wash px-3 py-2.5 text-label">
        <span className="font-semibold">{layerLabel[record.layer]}</span>
        {marketplace ? (
          <>
            <span className="text-ink-faint">›</span>
            <span>{marketplace}</span>
          </>
        ) : null}
        <span className="text-ink-faint">›</span>
        <span className="font-semibold">{record.name}</span>
        <span className="font-mono text-mono text-ink-muted">
          {record.summary}
        </span>
      </div>
    );
  }
  const file = record.pluginPath ?? shortPath(record.path, context);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 rounded-panel bg-wash px-3 py-2.5 text-label">
      <span className="font-semibold">{layerLabel[record.layer]}</span>
      {record.plugin ? (
        <>
          <span className="text-ink-faint">›</span>
          <button
            className="font-semibold underline decoration-hairline-strong underline-offset-2"
            onClick={() => onSelect(record.plugin?.id ?? "")}
          >
            {record.plugin.name} {record.plugin.version}
          </button>
        </>
      ) : null}
      <span className="text-ink-faint">›</span>
      <span className="font-mono text-mono break-words">
        <PathText path={file} />
      </span>
      {record.locator ? (
        <span className="font-mono text-mono text-ink-faint">
          {record.locator}
        </span>
      ) : null}
    </div>
  );
}

export function LinkRow({
  record,
  context,
  onSelect
}: {
  record: InventoryRecord;
  context: PathContext;
  onSelect(id: string): void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left hover:bg-hover"
      onClick={() => onSelect(record.id)}
    >
      <Link2
        aria-hidden="true"
        className="size-3.5 shrink-0 text-ink-muted"
        strokeWidth={1.6}
      />
      <ToolGlyph tool={record.tool} />
      <span className="min-w-0 flex-1 font-mono text-mono break-words">
        <PathText path={shortPath(record.path, context)} />
      </span>
      <ArrowRight
        aria-hidden="true"
        className="size-3.5 shrink-0 text-ink-faint"
        strokeWidth={1.6}
      />
    </button>
  );
}

export function Contributions({
  record,
  onKind
}: {
  record: InventoryRecord;
  onKind(kind: RecordKind): void;
}) {
  const entries = Object.entries(record.contributions ?? {}).filter(
    (entry): entry is [RecordKind, number] => Boolean(entry[1])
  );
  if (!entries.length) {
    return <p className="m-0 text-ink-faint">No discovered contributions.</p>;
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5">
      {entries.map(([kind, count]) => (
        <button
          className="rounded-panel border border-hairline px-2.5 py-2 text-left hover:border-hairline-strong"
          key={kind}
          onClick={() => onKind(kind)}
        >
          <strong className="block text-large tabular-nums">{count}</strong>
          <span className="text-caption text-ink-muted">{kindLabel[kind]}</span>
        </button>
      ))}
    </div>
  );
}

const kilobyte = 1024;

/** Token estimate when the characters are known, otherwise the file size in bytes. */
function amountText({ characters, bytes }: InventoryRecord): string {
  if (characters) {
    return `~${Math.round(characters / charactersPerToken).toLocaleString()} tokens`;
  }
  if (bytes === undefined) {
    return "";
  }
  return bytes < kilobyte
    ? `${bytes} B`
    : `${(bytes / kilobyte).toFixed(1)} KB`;
}

/** "36 lines · ~591 tokens", or "16 lines · 1.4 KB" for files measured in bytes. */
export function sizeText(record: InventoryRecord): string | undefined {
  const parts = [
    record.lines ? `${record.lines} lines` : "",
    amountText(record)
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** Facts the header and breadcrumb do not already show; nothing when there are none. */
export function Details({
  record,
  context
}: {
  record: InventoryRecord;
  context: PathContext;
}) {
  if (!record.details.length) {
    return null;
  }
  return (
    <Section title="Details">
      <dl className="m-0 grid grid-cols-[104px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-label">
        {record.details.map((row) => (
          <div className="contents" key={`${row.label}\0${row.value}`}>
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="m-0 break-words">{tildePath(row.value, context)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function Imports({
  imports,
  context
}: {
  imports: InstructionImport[];
  context: PathContext;
}) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0">
      {imports.map((item) => (
        <li className="grid gap-0.5" key={item.id}>
          <span className="font-mono text-mono break-words">
            <PathText path={tildePath(item.targetPath, context)} />
          </span>
          <span
            className={`text-caption ${item.state === "missing" || item.state === "unreadable" ? "text-problem" : "text-ink-muted"}`}
          >
            {item.reason}
          </span>
        </li>
      ))}
    </ul>
  );
}
