import { useLayoutEffect, useState } from "react";
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

/** The tab icon takes the selected tool's hue; `index.html` starts on the default tool's icon. */
function showFavicon(tool: ToolId): void {
  const icon =
    document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
    document.head.appendChild(document.createElement("link"));
  icon.rel = "icon";
  icon.type = "image/svg+xml";
  icon.href = `/favicon-${tool}.svg`;
}

export function useTool(): [ToolId, (tool: ToolId) => void] {
  const [tool, setTool] = useState<ToolId>(initialTool);
  // Before paint, so a Codex session never flashes the Claude accent.
  useLayoutEffect(() => {
    showFavicon(tool);
    // The accent in theme.css follows this attribute.
    document.documentElement.dataset.tool = tool;
  }, [tool]);
  function choose(next: ToolId) {
    window.localStorage.setItem(storageKey, next);
    setTool(next);
  }
  return [tool, choose];
}
