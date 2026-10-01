import type { ToolId } from "./inventory";
import type { SourceRef } from "./source-document";

// Browser-safe contract for copying a skill folder into a project or moving it to the global folders.

/** Copy leaves the skill where it is; promote moves it out of its project into the global skills folders. */
export type SkillTransferMode = "copy" | "promote";

export interface SkillTransferRequest {
  source: SourceRef;
  mode: SkillTransferMode;
  /** The project folder to copy into. Promote always targets the global folders. */
  projectPath?: string;
  tools: ToolId[];
}

export interface SkillTransferApply extends SkillTransferRequest {
  /** From the reviewed plan; the transfer stops if the folder changed since. */
  fingerprint: string;
}

export interface SkillTransferFile {
  /** Relative to the skill folder, with `/` separators. */
  path: string;
  type: "file" | "directory" | "symlink";
  bytes: number;
  executable: boolean;
}

export interface SkillTransferDestination {
  tool: ToolId;
  /** The skill folder that would be created. */
  path: string;
  /** Why this folder cannot be created; absent when it is free. */
  conflict?: string;
}

export interface SkillTransferPlan {
  mode: SkillTransferMode;
  name: string;
  sourceFolder: string;
  fingerprint: string;
  files: SkillTransferFile[];
  totalBytes: number;
  destinations: SkillTransferDestination[];
  warnings: string[];
  /** Why nothing can be written. The plan still lists what was found. */
  blocked?: string;
}

export interface SkillTransferResult {
  mode: SkillTransferMode;
  /** Each created folder with the inventory ID its SKILL.md receives on the next scan. */
  created: { tool: ToolId; path: string; entryId: string }[];
  /** Promote only: the project folder that was removed. */
  removed?: string;
  warnings: string[];
}
