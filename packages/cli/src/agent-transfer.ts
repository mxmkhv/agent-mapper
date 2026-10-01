import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type {
  InventoryEntry,
  SkillTransferDestination,
  SkillTransferPlan,
  SkillTransferRequest,
  SkillTransferResult,
  ToolId
} from "@agent-mapper/core";
import { convertAgent } from "./agent-convert";
import { agentId } from "./agent-record";
import { pathExists } from "./skill-folder";
import {
  inside,
  knownProject,
  realOrSelf,
  resolvedPath
} from "./skill-transfer-paths";
import type { TransferSetup } from "./skill-transfer-plan";
import { documentError, ioError } from "./source-document-errors";

const toolNames: Record<ToolId, string> = {
  claude: "Claude Code",
  codex: "Codex"
};

/** Where each tool reads a project's agents, and the file type it expects there. */
const agentHome: Record<ToolId, { folder: string; extension: string }> = {
  claude: { folder: join(".claude", "agents"), extension: ".md" },
  codex: { folder: join(".codex", "agents"), extension: ".toml" }
};

export interface AgentCopyPlan {
  plan: SkillTransferPlan;
  /** The exact text each destination file receives. */
  contents: Map<string, string>;
}

interface Draft {
  destination: SkillTransferDestination;
  content: string;
  dropped: string[];
  problem?: string;
}

/** The same tool gets the file as it is; the other tool gets it rewritten in its own format. */
function draftFor(
  tool: ToolId,
  input: { entry: InventoryEntry; content: string; project: string }
): Draft {
  const { entry, content } = input;
  const name = basename(entry.path, extname(entry.path));
  const home = agentHome[tool];
  const destination = {
    tool,
    path: join(input.project, home.folder, `${name}${home.extension}`)
  };
  if (tool === entry.tool) {
    return { destination, content, dropped: [] };
  }
  const converted = convertAgent({
    content,
    from: entry.tool,
    fallbackName: name
  });
  return "problem" in converted
    ? { destination, content: "", dropped: [], problem: converted.problem }
    : { destination, ...converted };
}

async function conflictFor(
  path: string,
  input: { entry: InventoryEntry; protectedRoots: string[] }
): Promise<string | undefined> {
  const real = await resolvedPath(path);
  const source = await realOrSelf(input.entry.path);
  if (path === input.entry.path || real === source) {
    return "This is where the agent already is.";
  }
  // A linked agents folder may lead into a plugin or managed folder, which stays read-only.
  if (input.protectedRoots.some((root) => inside(real, root))) {
    return `${path} leads into ${real}, a plugin or managed folder, which stays read-only.`;
  }
  const exists = await pathExists(path).catch((error: unknown) => {
    throw ioError(error, `Checking ${path}`);
  });
  return exists
    ? `${path} already exists. Rename or remove it first; nothing is overwritten.`
    : undefined;
}

/** The one file an agent is, in the shape a skill folder's listing takes. */
function sourceFile(path: string, content: string) {
  const bytes = Buffer.byteLength(content);
  return {
    sourceFolder: path,
    fingerprint: createHash("sha256").update(content).digest("hex"),
    files: [
      { path: basename(path), type: "file" as const, bytes, executable: false }
    ],
    totalBytes: bytes
  };
}

function blockedReason(
  request: SkillTransferRequest,
  drafts: readonly Draft[]
): string | undefined {
  if (!request.tools.length) {
    return "Choose Claude Code, Codex, or both.";
  }
  return drafts.find((draft) => draft.problem)?.problem;
}

async function copyableText(
  request: SkillTransferRequest,
  path: string
): Promise<string> {
  if (request.mode !== "copy") {
    throw documentError(
      "invalid_request",
      "Agents can be copied to a project, not moved to global."
    );
  }
  return readFile(path, "utf8").catch((error: unknown) => {
    throw ioError(error, `Reading ${path}`);
  });
}

/** What copying an agent file would write, read fresh from disk. Nothing is ever overwritten. */
export async function planAgentCopy(
  setup: TransferSetup,
  input: {
    request: SkillTransferRequest;
    entry: InventoryEntry;
    readOnlyRoots: string[];
  }
): Promise<AgentCopyPlan> {
  const { request, entry } = input;
  const content = await copyableText(request, entry.path);
  const project = knownProject(setup.knownProjects(), request.projectPath);
  const drafts = [...new Set(request.tools)].map((tool) =>
    draftFor(tool, { entry, content, project })
  );
  const protectedRoots = await Promise.all(
    [...setup.registry.protectedRoots(), ...input.readOnlyRoots].map(realOrSelf)
  );
  const destinations = await Promise.all(
    drafts.map(async ({ destination }) => ({
      ...destination,
      conflict: await conflictFor(destination.path, { entry, protectedRoots })
    }))
  );
  const plan: SkillTransferPlan = {
    mode: request.mode,
    name: entry.name,
    ...sourceFile(entry.path, content),
    destinations,
    warnings: drafts
      .filter((draft) => draft.dropped.length)
      .map(
        ({ destination, dropped }) =>
          `${toolNames[destination.tool]} has no equivalent for these ${toolNames[entry.tool]} settings, so the copy leaves them out: ${dropped.join(", ")}.`
      ),
    blocked: blockedReason(request, drafts)
  };
  return {
    plan,
    contents: new Map(
      drafts.map((draft) => [draft.destination.path, draft.content])
    )
  };
}

/** Writes each planned file with an exclusive create, and removes what it wrote if a later file fails. */
export async function writeAgentCopies({
  plan,
  contents
}: AgentCopyPlan): Promise<SkillTransferResult> {
  const created: SkillTransferResult["created"] = [];
  try {
    for (const { tool, path } of plan.destinations) {
      await mkdir(dirname(path), { recursive: true });
      // `wx` fails if the file appeared since the plan, so nothing is overwritten.
      await writeFile(path, contents.get(path) ?? "", { flag: "wx" });
      created.push({ tool, path, entryId: agentId({ tool, path }) });
    }
  } catch (error) {
    await Promise.all(created.map(({ path }) => rm(path, { force: true })));
    throw ioError(error, "Copying the agent");
  }
  return { mode: "copy", created, warnings: [] };
}
