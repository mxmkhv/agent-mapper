import type { ReactNode } from "react";
import type { ToolId } from "@agent-mapper/core";
import { Button } from "../ui/button";
import { PixelIcon } from "../ui/pixel-icon";
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
    <fieldset className="m-0 inline-flex min-w-0 border-2 border-ink p-0">
      <legend className="sr-only">Agent tool</legend>
      {tools.map((option) => (
        <button
          key={option}
          aria-pressed={tool === option}
          className={`inline-flex h-6 items-center gap-1.5 pr-2.5 pl-2 text-label font-semibold ${tool === option ? "bg-ink text-canvas" : "text-ink-muted hover:bg-wash hover:text-ink"}`}
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
          className="m-0 font-mono text-title whitespace-nowrap"
          title={title.path}
        >
          {title.name}
        </h1>
        {title.path ? (
          <span
            className="hidden min-w-12 truncate font-mono text-mono text-ink-muted xl:inline"
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
            <PixelIcon name="branch" />
            <span className="truncate">{title.branch}</span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <ToolToggle tool={props.tool} onTool={props.onTool} />
        {props.actions}
        <Button onClick={props.onSearch}>
          <PixelIcon name="search" />
          Search
          <kbd className="font-mono text-mono text-ink-faint">⌘K</kbd>
        </Button>
        <Button
          aria-label="Rescan"
          disabled={props.refreshing}
          onClick={props.onRescan}
          title={props.refreshing ? "Rescanning…" : `Rescan · scanned ${time}`}
          variant="icon"
        >
          <PixelIcon
            className={props.refreshing ? "animate-pulse" : ""}
            name="rescan"
          />
        </Button>
      </div>
    </header>
  );
}
