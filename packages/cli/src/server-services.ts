import { homedir } from "node:os";
import type { DiscoveryResult } from "./discovery";
import { configRoots } from "./inventory";
import { managedClaudeDirectory } from "./managed-claude-reader";
import { SkillTransferService } from "./skill-transfer";
import { SourceDeleteService } from "./source-delete";
import type { MoveToTrash } from "./system-trash";
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
  /** Projects and worktrees from the latest discovery; skills may be copied into them. */
  discovered: Set<string>;
}

/** Per-server state shared by the API routes: the latest scans and what they allow. */
export function createServices(options: {
  home?: string;
  codexHome?: string;
  managedClaudeDir?: string;
  historyRoot?: string;
  trash?: MoveToTrash;
}): ServerServices {
  const home = options.home ?? homedir();
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
    deletes: new SourceDeleteService({ registry, trash: options.trash }),
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
