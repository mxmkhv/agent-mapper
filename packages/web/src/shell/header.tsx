import type { ReactNode } from "react";
import type { ToolId } from "@agent-mapper/core";
import { GitBranch, RefreshCw, Search } from "lucide-react";
import { Button } from "../ui/button";
import { ToolGlyph, toolName } from "../ui/marks";

export interface HeaderTitle {
  name: string;
  path?: string;
  branch?: string;
  subtitle?: string;
}

interface HeaderProps {
  title: HeaderTitle;
  tool: ToolId;
  scannedAt: string;
  refreshing: boolean;
  onTool(tool: ToolId): void;
  onSearch(): void;
  onRescan(): void;
  /** Extra controls before Search, such as the Drafts menu. */
  actions?: ReactNode;
}

const tools: ToolId[] = ["claude", "codex"];

function ToolToggle({ tool, onTool }: Pick<HeaderProps, "tool" | "onTool">) {
  return (
    <fieldset className="m-0 inline-flex min-w-0 gap-0.5 rounded-panel border border-hairline bg-wash p-0.5">
      <legend className="sr-only">Agent tool</legend>
      {tools.map((option) => (
        <button
          key={option}
          aria-pressed={tool === option}
          className={`inline-flex h-6 items-center gap-1.5 rounded-control pr-2.5 pl-1.5 text-label font-semibold ${tool === option ? "bg-surface text-ink shadow-raised" : "text-ink-muted hover:text-ink"}`}
          onClick={() => onTool(option)}
        >
          <ToolGlyph tool={option} muted={tool !== option} />
          {toolName[option]}
        </button>
      ))}
    </fieldset>
  );
}

export function Header(props: HeaderProps) {
  const { title } = props;
  const time = new Date(props.scannedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
  return (
    <header className="flex min-h-14 min-w-0 items-center gap-4 px-5 py-3">
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <h1
          className="m-0 text-title font-semibold tracking-tight whitespace-nowrap"
          title={title.path}
        >
          {title.name}
        </h1>
        {title.path ? (
          <span
            className="hidden min-w-12 truncate font-mono text-label text-ink-muted xl:inline"
            title={title.path}
          >
            {title.path}
          </span>
        ) : null}
        {title.subtitle ? (
          <span className="truncate text-ink-muted">{title.subtitle}</span>
        ) : null}
        {title.branch ? (
          <span
            className="inline-flex min-w-0 items-center gap-1 text-label text-ink-muted"
            title={title.branch}
          >
            <GitBranch
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.6}
            />
            <span className="truncate">{title.branch}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <ToolToggle tool={props.tool} onTool={props.onTool} />
        {props.actions}
        <Button onClick={props.onSearch}>
          <Search aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
          Search
          <kbd className="font-mono text-caption text-ink-faint">⌘K</kbd>
        </Button>
        <span className="hidden text-caption whitespace-nowrap text-ink-faint xl:inline">
          {props.refreshing ? "Rescanning…" : `Scanned ${time}`}
        </span>
        <Button
          aria-label="Rescan"
          disabled={props.refreshing}
          onClick={props.onRescan}
          title={`Rescan · scanned ${time}`}
          variant="icon"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-3.5 ${props.refreshing ? "animate-spin" : ""}`}
            strokeWidth={1.8}
          />
        </Button>
      </div>
    </header>
  );
}
