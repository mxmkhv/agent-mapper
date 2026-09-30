import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type {
  Finding,
  FindingCode,
  FindingSource,
  InstructionImport,
  PluginRecord,
  ResolvedEntry,
  ToolId
} from "@agent-mapper/core";

const instructionReviewLines = 200;
const substantiveCharacters = 80;
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

function finding(input: FindingInput): Finding {
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

function source(item: ResolvedEntry): FindingSource {
  return { id: item.entry.id, path: item.entry.path };
}

function entryFindings(item: ResolvedEntry): Finding[] {
  const status = sourceStatusFinding(item);
  if (status) {
    return [status];
  }
  const { entry, resolution } = item;
  if (
    entry.kind === "instruction" &&
    resolution.availability === "expected" &&
    (entry.lineCount ?? 0) > instructionReviewLines
  ) {
    return [
      finding({
        tool: entry.tool,
        code: "long-instruction",
        level: "review",
        title: "Review long instruction file",
        reason: `${entry.lineCount} lines. The 200-line threshold is a review heuristic, not a tool limit.`,
        sources: [source(item)]
      })
    ];
  }
  return [];
}

function sourceStatusFinding(item: ResolvedEntry): Finding | undefined {
  const { entry, resolution } = item;
  const sources = [source(item)];
  if (entry.isSymlink && entry.readState === "missing") {
    return finding({
      tool: entry.tool,
      code: "broken-symlink",
      level: "problem",
      title: "Broken source link",
      reason:
        "The linked target is missing. Repair the link or remove its reference.",
      sources
    });
  }
  if (entry.readState === "unreadable") {
    return finding({
      tool: entry.tool,
      code: "unreadable-source",
      level: "coverage",
      title: "Source could not be read",
      reason:
        "Check the file permissions, then rescan to determine whether it applies.",
      sources
    });
  }
  if (resolution.availability === "shadowed") {
    return finding({
      tool: entry.tool,
      code: "shadowed-source",
      level: "information",
      title: "Source is shadowed",
      reason: resolution.reason,
      sources
    });
  }
  return undefined;
}

function pluginFindings(plugin: PluginRecord): Finding[] {
  if (plugin.state !== "missing") {
    return [];
  }
  return [
    finding({
      tool: plugin.tool,
      code: "missing-plugin",
      level: "problem",
      title: "Configured plugin is missing",
      reason: "Check the plugin installation and configuration, then rescan.",
      sources: [{ id: plugin.id, path: plugin.sourcePath }]
    })
  ];
}

function importFindings(imports: InstructionImport[]): Finding[] {
  return imports
    .filter((item) => item.state === "missing")
    .map((item) =>
      finding({
        tool: "claude",
        code: "missing-import",
        level: "problem",
        title: "Imported file is missing",
        reason: `The explicit import target is missing: ${item.targetPath}`,
        identity: item.id,
        sources: [{ id: item.sourceEntryId, path: item.sourcePath }]
      })
    );
}

function paragraphs(content: string): Set<string> {
  return new Set(
    content
      .split(/\r?\n\s*\r?\n/)
      .map((text) => text.replace(/\s+/g, " ").trim())
      .filter(
        (text) => text.length >= substantiveCharacters && !text.startsWith("#")
      )
  );
}

async function repeatedFindings(
  items: ResolvedEntry[],
  contentFor?: (path: string) => string | undefined
): Promise<{ findings: Finding[]; errors: string[] }> {
  const candidates = items.filter(
    ({ entry, resolution }) =>
      entry.kind === "instruction" &&
      !entry.inlineContent &&
      entry.readState === "readable" &&
      resolution.availability === "expected" &&
      resolution.loading === "startup"
  );
  const seen = new Map<string, ResolvedEntry[]>();
  const errors: string[] = [];
  for (const item of candidates) {
    try {
      const content =
        contentFor?.(item.entry.path) ??
        (await readFile(item.entry.path, "utf8"));
      for (const paragraph of paragraphs(content)) {
        const key = `${item.entry.tool}:${paragraph}`;
        seen.set(key, [...(seen.get(key) ?? []), item]);
      }
    } catch (error) {
      errors.push(
        `${item.entry.path}: Repeated-text check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return { findings: pairFindings(seen), errors };
}

function pairFindings(seen: Map<string, ResolvedEntry[]>): Finding[] {
  const pairs = new Map<
    string,
    { first: ResolvedEntry; second: ResolvedEntry; count: number }
  >();
  for (const matches of seen.values()) {
    for (let left = 0; left < matches.length; left += 1) {
      for (let right = left + 1; right < matches.length; right += 1) {
        const first = matches[left]!;
        const second = matches[right]!;
        const key = [first.entry.id, second.entry.id].sort().join(":");
        const pair = pairs.get(key);
        pairs.set(key, { first, second, count: (pair?.count ?? 0) + 1 });
      }
    }
  }
  return [...pairs.values()].map(({ first, second, count }) =>
    finding({
      tool: first.entry.tool,
      code: "repeated-instruction",
      level: "review",
      title: "Repeated instruction paragraphs",
      reason: `${count} paragraph${count === 1 ? " repeats" : "s repeat"} in both files`,
      sources: [source(first), source(second)]
    })
  );
}

export async function buildFindings(options: {
  items: ResolvedEntry[];
  plugins: PluginRecord[];
  imports: InstructionImport[];
  contentFor?: (path: string) => string | undefined;
}): Promise<{ findings: Finding[]; errors: string[] }> {
  const { items, plugins, imports } = options;
  const repeated = await repeatedFindings(items, options.contentFor);
  const findings = [
    ...items.flatMap(entryFindings),
    ...plugins.flatMap(pluginFindings),
    ...importFindings(imports),
    ...repeated.findings
  ];
  findings.sort(
    (a, b) =>
      a.tool.localeCompare(b.tool) ||
      a.code.localeCompare(b.code) ||
      a.sources[0]!.path.localeCompare(b.sources[0]!.path)
  );
  return { findings, errors: repeated.errors };
}
