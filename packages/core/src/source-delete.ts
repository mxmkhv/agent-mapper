import type { SourceRef } from "./source-document";

// Browser-safe contract for moving a skill folder or an agent file to the Trash.

export interface SourceDeletePlan {
  kind: "skill" | "agent";
  name: string;
  /** What goes to the Trash. */
  path: string;
  /** A link goes alone; the folder or file it points to stays. */
  target: "folder" | "file" | "link";
  /** For a link: where it points. */
  linkTarget?: string;
  /** For a link: what it points to is missing. */
  broken?: boolean;
  /** Files inside the folder, or 1 for a file or link. */
  files: number;
  /**
   * The folder holds more than can be checked, so the delete is blocked. Past the item cap the listing stops and
   * counts are a lower bound; past the byte cap the counts are complete.
   */
  tooLarge?: "items" | "bytes";
  totalBytes: number;
  /** The delete stops if the target changed since this plan. */
  fingerprint: string;
  /** Other paths that lead here and will break, and installer records left behind. */
  warnings: string[];
  /** Why nothing can be deleted. */
  blocked?: string;
}

export interface SourceDeleteApply {
  source: SourceRef;
  fingerprint: string;
}

export interface SourceDeleteResult {
  /** The path that was moved to the Trash. */
  trashed: string;
}
