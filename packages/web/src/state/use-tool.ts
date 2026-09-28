import { useState } from "react";
import type { ToolId } from "@agent-mapper/core";

const storageKey = "agent-mapper:tool";

function isTool(value: string | null): value is ToolId {
  return value === "claude" || value === "codex";
}

/** `?tools=codex` from the CLI wins over the remembered choice; Claude Code is the default. */
function initialTool(): ToolId {
  const fromUrl = new URLSearchParams(window.location.search).get("tools");
  if (isTool(fromUrl)) {
    return fromUrl;
  }
  const stored = window.localStorage.getItem(storageKey);
  return isTool(stored) ? stored : "claude";
}

export function useTool(): [ToolId, (tool: ToolId) => void] {
  const [tool, setTool] = useState<ToolId>(initialTool);
  function choose(next: ToolId) {
    window.localStorage.setItem(storageKey, next);
    setTool(next);
  }
  return [tool, choose];
}
