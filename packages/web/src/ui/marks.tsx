import type { ToolId } from "@agent-mapper/core";
import type { Tier } from "../model/record-types";
import { PixelIcon } from "./pixel-icon";

export const toolName = {
  claude: "Claude Code",
  codex: "Codex",
  unknown: "Unknown tool"
} satisfies Record<ToolId | "unknown", string>;

const glyphLetter = { claude: "C", codex: "X", unknown: "?" } satisfies Record<
  ToolId | "unknown",
  string
>;

const glyphColor = {
  claude: "bg-claude text-black",
  codex: "bg-codex text-black",
  unknown: "bg-ink text-canvas"
} satisfies Record<ToolId | "unknown", string>;

/** Letter plus color, so a tool is never identified by color alone. Muted is an outline: the tool that is not selected. */
export function ToolGlyph({
  tool,
  muted
}: {
  tool: ToolId | "unknown";
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-grid size-[15px] shrink-0 place-items-center font-mono text-glyph ${muted ? "border border-current text-ink-muted" : glyphColor[tool]}`}
      title={toolName[tool]}
    >
      {glyphLetter[tool]}
    </span>
  );
}

/** Shapes take the colour of the text around them, so a marker inverts with its row. Only a problem has a colour of its own. */
const markerStyle = {
  active: "bg-current",
  inactive: "border border-current",
  unknown: "border border-dotted border-current",
  approval: "border border-dotted border-current",
  problem: "rotate-45 bg-problem"
} satisfies Record<Tier, string>;

/** Shape carries the state: a solid square is normal, hollow is inactive, dotted is unknown, and a problem is a red diamond, so it still reads on an accent fill where red does not. */
export function StateMarker({ tier, large }: { tier: Tier; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 ${large ? "size-[9px]" : "size-[7px]"} ${markerStyle[tier]}`}
    />
  );
}

export function StateLabel({ tier, text }: { tier: Tier; text?: string }) {
  if (!text) {
    return null;
  }
  const questioned = tier === "unknown" || tier === "approval";
  return (
    <span
      className={`text-caption whitespace-nowrap ${tier === "problem" ? "font-semibold text-problem" : "text-ink-muted"}`}
    >
      {questioned ? `? ${text}` : text}
    </span>
  );
}

/** A dotted outline marks a symlink: the entry is real, the file lives elsewhere. */
export const symlinkChip =
  "inline-flex h-[18px] items-center gap-1 border border-dotted border-current px-1.5 text-caption font-medium whitespace-nowrap";

export function SymlinkGlyph() {
  return <PixelIcon name="link" />;
}

export function SymlinkBadge({
  target,
  text = "symlink",
  title
}: {
  target?: string;
  text?: string;
  /** Replaces the default "Symlink → target" tooltip. */
  title?: string;
}) {
  return (
    <span
      className={symlinkChip}
      title={title ?? (target ? `Symlink → ${target}` : undefined)}
    >
      <SymlinkGlyph />
      {text}
    </span>
  );
}
