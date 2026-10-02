import { homedir } from "node:os";
import type { HostInfo } from "@agent-mapper/core";
import { createDesktop, type Desktop } from "./desktop";
import { hostInfo } from "./desktop-session";
import type { DiscoveryResult } from "./discovery";
import { configRoots } from "./inventory";
import { managedClaudeDirectory } from "./managed-claude-reader";
import { SkillTransferService } from "./skill-transfer";
import { SourceDeleteService } from "./source-delete";
import { systemTrash, type MoveToTrash } from "./system-trash";
import type { SourcePathStore } from "./source-actions";
import { defaultHistoryRoot } from "./source-document-history-folder";
import { SourceDocumentRegistry } from "./source-document-registry";
import { SourceDocumentService } from "./source-document-service";

export interface ServerServices {
  sourcePaths: SourcePathStore;
  registry: SourceDocumentRegistry;
  documents: SourceDocumentService;
  skills: SkillTransferService;
  deletes: SourceDeleteService;
  /** The server's platform, which decides file manager wording in the UI. */
  host: HostInfo;
  desktop: Desktop;
  /** Projects and worktrees from the latest discovery; skills may be copied into them. */
  discovered: Set<string>;
}

export interface ServiceOptions {
  home?: string;
  codexHome?: string;
  managedClaudeDir?: string;
  /** Private revision snapshots; defaults to the platform data folder. */
  historyRoot?: string;
  /** Defaults to the running platform. Decides file manager wording and the default Trash. */
  platform?: NodeJS.Platform;
  /** Opens sources and reveals them in the file manager; defaults to the platform's desktop. */
  desktop?: Desktop;
  /** Moves deleted skills and agents away; defaults to the platform's Trash. */
  trash?: MoveToTrash;
}

/** Per-server state shared by the API routes: the latest scans and what they allow. */
export function createServices(options: ServiceOptions): ServerServices {
  const home = options.home ?? homedir();
  const platform = options.platform ?? process.platform;
  const system = { platform, env: process.env };
  const registry = new SourceDocumentRegistry(managedClaudeDirectory(options));
  const discovered = new Set<string>();
  return {
    sourcePaths: new Map(),
    registry,
    discovered,
    documents: new SourceDocumentService({
      registry,
      historyRoot: options.historyRoot ?? defaultHistoryRoot(home)
    }),
    deletes: new SourceDeleteService({
      registry,
      trash: options.trash ?? systemTrash(system)
    }),
    host: hostInfo(platform),
    desktop: options.desktop ?? createDesktop(system),
    skills: new SkillTransferService({
      registry,
      roots: () => ({
        home,
        claude: configRoots(
          { workingDirectory: home, codexHome: options.codexHome },
          home
        ).roots.claude
      }),
      knownProjects: () => [...discovered, ...registry.projectDirectories()]
    })
  };
}

export function rememberProjects(
  discovered: Set<string>,
  result: DiscoveryResult
): void {
  discovered.clear();
  for (const project of result.projects) {
    discovered.add(project.path);
    for (const tree of project.worktrees ?? []) {
      discovered.add(tree.path);
    }
  }
}
