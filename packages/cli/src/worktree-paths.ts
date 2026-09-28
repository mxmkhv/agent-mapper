import { basename } from "node:path";
import type { WorktreeDifference } from "@agent-mapper/core";

const excluded = new Set([
  ".git",
  ".worktrees",
  ".artifacts",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".expo",
  "Pods",
  "DerivedData",
  "target",
  ".turbo",
  "coverage",
  ".venv"
]);
const topDirectories = new Map([
  [
    ".claude",
    new Set(["agents", "skills", "commands", "hooks", "plugins", "rules"])
  ],
  [".codex", new Set(["agents", "skills", "hooks", "plugins"])],
  [".agents", new Set(["skills"])]
]);
const topFiles = new Map([
  [
    ".claude",
    new Set([
      "settings.json",
      "settings.local.json",
      "CLAUDE.md",
      "AGENTS.md",
      ".mcp.json"
    ])
  ],
  [
    ".codex",
    new Set(["config.toml", "hooks.json", "AGENTS.md", "AGENTS.override.md"])
  ],
  [".agents", new Set(["AGENTS.md"])]
]);
const instructions = new Set([
  "AGENTS.md",
  "AGENTS.override.md",
  "CLAUDE.md",
  "CLAUDE.local.md"
]);

function configRoot(
  parts: string[]
): { index: number; name: string } | undefined {
  const index = parts.findIndex(
    (part) =>
      topDirectories.has(part) ||
      part === ".claude-plugin" ||
      part === ".codex-plugin"
  );
  return index < 0 ? undefined : { index, name: parts[index] ?? "" };
}

export function canEnter(parts: string[], name: string): boolean {
  if (excluded.has(name)) {
    return false;
  }
  const config = configRoot(parts);
  if (!config) {
    return true;
  }
  if (parts.length === config.index + 1 && topDirectories.has(config.name)) {
    return topDirectories.get(config.name)?.has(name) ?? false;
  }
  return name !== "cache";
}

export function isConfigLink(parts: string[], name: string): boolean {
  return (
    Boolean(configRoot(parts)) ||
    topDirectories.has(name) ||
    name === ".claude-plugin" ||
    name === ".codex-plugin"
  );
}

export function included(parts: string[], name: string): boolean {
  const config = configRoot(parts);
  if (!config) {
    return instructions.has(name) || name === ".mcp.json";
  }
  if (parts.length === config.index + 1 && topFiles.has(config.name)) {
    return topFiles.get(config.name)?.has(name) ?? false;
  }
  return true;
}

export function kind(relativePath: string): WorktreeDifference["kind"] {
  const parts = relativePath.split("/");
  const name = basename(relativePath);
  if (instructions.has(name) || parts.includes("rules")) {
    return "instruction";
  }
  if (parts.includes("agents")) {
    return "agent";
  }
  if (parts.includes("skills")) {
    return "skill";
  }
  if (parts.includes("commands")) {
    return "command";
  }
  if (parts.includes("hooks") || name === "hooks.json") {
    return "hook";
  }
  if (
    parts.includes("plugins") ||
    parts.includes(".claude-plugin") ||
    parts.includes(".codex-plugin")
  ) {
    return "plugin";
  }
  if (name === ".mcp.json") {
    return "mcp";
  }
  return "settings";
}

export function tool(relativePath: string): WorktreeDifference["tool"] {
  const parts = relativePath.split("/");
  const name = basename(relativePath);
  if (
    parts.includes(".claude") ||
    parts.includes(".claude-plugin") ||
    name.startsWith("CLAUDE") ||
    name === ".mcp.json"
  ) {
    return "claude";
  }
  if (parts.includes(".codex") || parts.includes(".codex-plugin")) {
    return "codex";
  }
  return "shared";
}
