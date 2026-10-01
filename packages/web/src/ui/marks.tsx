import type { ToolId } from "@agent-mapper/core";
import { Link2 } from "lucide-react";
import type { Tier } from "../model/record-types";

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
  claude: "bg-claude",
  codex: "bg-codex",
  unknown: "bg-ink-faint"
} satisfies Record<ToolId | "unknown", string>;

/** Letter plus color, so a tool is never identified by color alone. */
export function ToolGlyph({
  tool,
  muted
}: {
  tool: ToolId | "unknown";
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-grid size-[15px] shrink-0 place-items-center rounded-glyph text-glyph font-bold text-white ${muted ? "bg-ink-faint" : glyphColor[tool]}`}
      title={toolName[tool]}
    >
      {glyphLetter[tool]}
    </span>
  );
}

const markerStyle = {
  active: "bg-ink opacity-55",
  inactive: "border-[1.5px] border-ink-faint",
  unknown: "border-[1.5px] border-dashed border-ink-muted",
  approval: "border-[1.5px] border-dashed border-ink-muted",
  problem: "bg-problem"
} satisfies Record<Tier, string>;

const sourceTones = [
  "bg-source-1",
  "bg-source-2",
  "bg-source-3",
  "bg-source-4"
];

/** The dot color for the nth shared source repo in a group; the palette repeats past its end. */
export function sourceTone(index: number): string {
  return sourceTones[index % sourceTones.length] ?? "";
}

/** Shape carries the state: solid is normal, hollow is inactive, dashed is unknown, red is a problem. A source tone only recolors the normal dot. */
export function StateMarker({
  tier,
  large,
  tone
}: {
  tier: Tier;
  large?: boolean;
  tone?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${large ? "size-[9px]" : "size-[7px]"} ${tier === "active" && tone ? tone : markerStyle[tier]}`}
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
      className="inline-flex h-[18px] items-center gap-[3px] rounded-pill border border-hairline bg-surface px-1.5 text-caption font-medium whitespace-nowrap text-ink-muted"
      title={title ?? (target ? `Symlink → ${target}` : undefined)}
    >
      <Link2 aria-hidden="true" className="size-[11px]" strokeWidth={1.8} />
      {text}
    </span>
  );
}
