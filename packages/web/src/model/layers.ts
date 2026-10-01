import type { ToolId } from "@agent-mapper/core";
import type { InventoryRecord, Layer } from "./record-types";
import { isInside, tildePath, type PathContext } from "./paths";

export const layerLabel = {
  managed: "Managed",
  global: "Global",
  plugins: "Plugins",
  project: "Project",
  user: "User"
} satisfies Record<Layer, string>;

const localFile = /\.local\.[a-z]+$/;

export function layerOf(input: {
  kind: string;
  scope: string;
  path: string;
  pluginId?: string;
}): Layer {
  if (input.kind === "plugin" || input.pluginId) {
    return "plugins";
  }
  if (localFile.test(input.path)) {
    return "user";
  }
  if (input.scope === "managed") {
    return "managed";
  }
  return input.scope === "project" ? "project" : "global";
}

interface HintScope {
  records: readonly InventoryRecord[];
  context: PathContext;
  tool: ToolId;
}

/** Directories under home where the tool's global files were actually found, e.g. `~/.codex · ~/.agents`. */
function globalHint({ records, context, tool }: HintScope): string {
  const folders = new Set<string>();
  for (const record of records) {
    const parts = tildePath(record.path, context).split("/");
    if (record.layer === "global" && parts[0] === "~" && parts.length > 2) {
      folders.add(`~/${parts[1]}`);
    }
  }
  return folders.size ? [...folders].join(" · ") : `~/.${tool}`;
}

const otherHints = {
  managed: "Organization policy",
  plugins: "Selected versions",
  user: "*.local files · only you"
} satisfies Record<Exclude<Layer, "global" | "project">, string>;

export function layerHint(layer: Layer, scope: HintScope): string {
  if (layer === "global") {
    return globalHint(scope);
  }
  if (layer === "project") {
    const root = scope.context.projectRoot;
    const aboveRepo = scope.records.some(
      (record) =>
        record.layer === "project" && root && !isInside(record.path, root)
    );
    return aboveRepo ? "Repo and parent folders" : "In this repo";
  }
  return otherHints[layer];
}
