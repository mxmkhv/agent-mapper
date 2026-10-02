import { useState } from "react";
import type { WorktreeDifference } from "@agent-mapper/core";
import type { Tier } from "../../model/record-types";
import { StateMarker, ToolGlyph } from "../../ui/marks";
import { PathLine } from "../../ui/path-line";
import { PixelIcon } from "../../ui/pixel-icon";
import type { DifferenceGroup } from "./difference-groups";

export const differenceInfo = {
  "only-main": {
    label: "Only in main checkout",
    tier: "inactive",
    reason:
      "This file is absent here. It does not contribute to this checkout's inventory."
  },
  "only-here": {
    label: "Only here",
    tier: "active",
    reason: "This file exists only in the selected checkout."
  },
  "different-content": {
    label: "Different content",
    tier: "unknown",
    reason: "Both checkouts have this file, but their contents differ."
  },
  unknown: {
    label: "Unknown",
    tier: "unknown",
    reason:
      "At least one file could not be read. Open the source and check permissions or its link target."
  },
  mixed: {
    label: "Mixed changes",
    tier: "unknown",
    reason: "Files in this folder differ in different ways."
  }
} satisfies Record<
  DifferenceGroup["state"],
  { label: string; tier: Tier; reason: string }
>;

// No state column: the section heading names the state every row shares.
const rowClass =
  "grid h-9 w-full grid-cols-[11px_7px_minmax(0,1fr)_15px] items-center gap-3 px-3 text-left [&+*]:border-t [&+*]:border-dotted [&+*]:border-hairline";

interface ListProps {
  groups: DifferenceGroup[];
  selectedId?: string;
  onSelect(id: string): void;
}

function FileRow({
  row,
  folder,
  selected,
  onSelect
}: {
  row: WorktreeDifference;
  /** Set when the row sits inside a collapsed folder group; its path then reads relative to it. */
  folder?: string;
  selected: boolean;
  onSelect(id: string): void;
}) {
  const info = differenceInfo[row.state];
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className={`${rowClass} ${folder ? "pl-9" : ""} ${selected ? "on-accent bg-accent" : "hover:bg-wash"}`}
      onClick={() => onSelect(row.id)}
    >
      <PixelIcon name="diff" />
      <StateMarker tier={info.tier} />
      {folder && row.relativePath === folder ? (
        // A symlinked skill folder is itself a difference; it has no file name of its own.
        <span className="text-label text-ink-muted">Folder itself</span>
      ) : (
        <PathLine
          path={
            folder
              ? row.relativePath.slice(folder.length + 1)
              : row.relativePath
          }
          title={row.relativePath}
        />
      )}
      {row.tool === "shared" ? (
        <span />
      ) : (
        <ToolGlyph muted={selected} tool={row.tool} />
      )}
    </button>
  );
}

/**
 * Skill and agent folders collapse into one row each: a whole skill missing from a branch is one fact,
 * not forty files.
 */
export function DifferenceList({ groups, selectedId, onSelect }: ListProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  return groups.map((group) => {
    const [only] = group.rows;
    // Loose files stay single rows; every skill or agent folder is a group, even with one file.
    if (group.rows.length === 1 && only && only.relativePath === group.key) {
      return (
        <FileRow
          key={group.key}
          onSelect={onSelect}
          row={only}
          selected={only.id === selectedId}
        />
      );
    }
    const expanded = open.has(group.key);
    const info = differenceInfo[group.state];
    return (
      <div
        className="[&+*]:border-t [&+*]:border-dotted [&+*]:border-hairline"
        key={group.key}
      >
        <button
          aria-expanded={expanded}
          className={`${rowClass} hover:bg-wash`}
          onClick={() => toggle(group.key)}
        >
          <PixelIcon name={expanded ? "chevron-down" : "chevron-right"} />
          <StateMarker tier={info.tier} />
          <span className="flex min-w-0 items-center gap-3">
            <PathLine path={group.label} />
            <span className="shrink-0 font-mono text-mono text-ink-faint">
              {group.rows.length} {group.rows.length === 1 ? "file" : "files"}
            </span>
          </span>
          <span />
        </button>
        {expanded
          ? group.rows.map((row) => (
              <FileRow
                key={row.id}
                folder={group.label}
                onSelect={onSelect}
                row={row}
                selected={row.id === selectedId}
              />
            ))
          : null}
      </div>
    );
  });
}
