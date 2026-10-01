import { createHash } from "node:crypto";
import type {
  Finding,
  FindingCode,
  FindingSource,
  ResolvedEntry,
  ToolId
} from "@agent-mapper/core";

const idLength = 20;

interface FindingInput {
  tool: ToolId;
  code: FindingCode;
  level: Finding["level"];
  title: string;
  reason: string;
  sources: FindingSource[];
  identity?: string;
}

export function finding(input: FindingInput): Finding {
  const sources = [...input.sources].sort((a, b) =>
    a.path.localeCompare(b.path)
  );
  const key = [
    input.tool,
    input.code,
    ...sources.map(({ id }) => id),
    input.identity ?? ""
  ].join(":");
  const { identity: _identity, ...record } = input;
  return {
    ...record,
    id: createHash("sha256").update(key).digest("hex").slice(0, idLength),
    sources
  };
}

export function source(item: ResolvedEntry): FindingSource {
  return { id: item.entry.id, path: item.entry.path };
}
