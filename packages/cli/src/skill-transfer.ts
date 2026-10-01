import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  SkillTransferApply,
  SkillTransferPlan,
  SkillTransferRequest,
  SkillTransferResult
} from "@agent-mapper/core";
import { planAgentCopy, writeAgentCopies } from "./agent-transfer";
import { readSkillFolder, type SkillFolder } from "./skill-folder";
import { placeSkillFolder, removeMadeFolders } from "./skill-folder-place";
import {
  planTransfer,
  type TransferSetup,
  type TransferSource
} from "./skill-transfer-plan";
import { candidateKey, entryIdFor } from "./source-entry";
import { documentError } from "./source-document-errors";

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

interface Placed {
  path: string;
  madeFrom?: string;
}

/** Removes the folders a failed transfer created, so it leaves no half result. */
async function rollback(placed: readonly Placed[], error: unknown) {
  const problems: string[] = [];
  for (const { path, madeFrom } of placed) {
    try {
      await rm(path, { recursive: true, force: true });
      problems.push(await removeMadeFolders(dirname(path), madeFrom));
    } catch (cleanup) {
      problems.push(
        ` The copy at ${path} could not be removed (${reasonOf(cleanup)}); delete it by hand.`
      );
    }
  }
  const detail = problems.join("");
  if (!detail) {
    return error;
  }
  if (error instanceof Error) {
    error.message += detail;
    return error;
  }
  return new Error(`${reasonOf(error)}${detail}`);
}

/** The move finishes only if the project folder still holds exactly what was copied. */
async function removeSource(
  source: TransferSource,
  fingerprint: string
): Promise<{ removed?: string; warnings: string[] }> {
  const kept = (reason: string) => ({
    warnings: [
      `${source.entryFolder} was kept because ${reason}. Compare it with the global copy and remove one by hand; until then both apply.`
    ]
  });
  let now;
  try {
    now = await readSkillFolder(source.sourceFolder);
  } catch (error) {
    return kept(`it could not be read again (${reasonOf(error)})`);
  }
  if (now.fingerprint !== fingerprint) {
    return kept("it changed during the move");
  }
  try {
    await rm(source.entryFolder, { recursive: true });
    return { removed: source.entryFolder, warnings: [] };
  } catch (error) {
    return {
      warnings: [
        `The skill was copied to the global folder, but removing ${source.entryFolder} failed (${reasonOf(error)}), so it may be partly deleted. The global copy is complete; delete what remains of the project folder by hand.`
      ]
    };
  }
}

async function transfer(input: {
  plan: SkillTransferPlan;
  source: TransferSource;
  folder: SkillFolder;
}): Promise<SkillTransferResult> {
  const { plan } = input;
  const created: SkillTransferResult["created"] = [];
  const placed: Placed[] = [];
  try {
    for (const destination of plan.destinations) {
      const { madeFrom } = await placeSkillFolder(input.folder, {
        destination: destination.path,
        fingerprint: plan.fingerprint
      });
      placed.push({ path: destination.path, madeFrom });
      created.push({
        tool: destination.tool,
        path: destination.path,
        entryId: entryIdFor(
          candidateKey({
            tool: destination.tool,
            kind: "skill",
            path: join(destination.path, "SKILL.md")
          })
        )
      });
    }
  } catch (error) {
    throw await rollback(placed, error);
  }
  if (plan.mode === "copy") {
    return { mode: "copy", created, warnings: [] };
  }
  return {
    mode: "promote",
    created,
    ...(await removeSource(input.source, plan.fingerprint))
  };
}

/**
 * Copies skills and agents into projects, and moves project skills to the global folders of each tool.
 * A skill is a folder copied as it is; an agent is one file, rewritten when it changes tools.
 */
export class SkillTransferService {
  /** Skill folders being written or removed right now. */
  private readonly busy = new Set<string>();

  constructor(private readonly setup: TransferSetup) {}

  async plan(request: SkillTransferRequest): Promise<SkillTransferPlan> {
    return (await this.planned(request)).plan;
  }

  /** The plan with the step that carries it out, chosen by what the source is. */
  private async planned(request: SkillTransferRequest): Promise<{
    plan: SkillTransferPlan;
    run(): Promise<SkillTransferResult>;
  }> {
    const found = this.setup.registry.lookup(request.source);
    if (found?.item.entry.kind === "agent") {
      const copy = await planAgentCopy(this.setup, {
        request,
        entry: found.item.entry,
        readOnlyRoots: found.readOnlyRoots
      });
      return { plan: copy.plan, run: () => writeAgentCopies(copy) };
    }
    const skill = await planTransfer(this.setup, request);
    return { plan: skill.plan, run: () => transfer(skill) };
  }

  async apply(request: SkillTransferApply): Promise<SkillTransferResult> {
    const planned = await this.planned(request);
    const { plan } = planned;
    if (plan.blocked) {
      throw documentError("invalid_request", plan.blocked);
    }
    if (plan.fingerprint !== request.fingerprint) {
      throw documentError(
        "conflict",
        "The source changed since the preview. Nothing was written; review the new preview and try again."
      );
    }
    const conflict = plan.destinations.find((item) => item.conflict)?.conflict;
    if (conflict) {
      throw documentError("conflict", conflict);
    }
    const keys = [
      plan.sourceFolder,
      ...plan.destinations.map((item) => item.path)
    ];
    if (keys.some((key) => this.busy.has(key))) {
      throw documentError(
        "busy",
        "Another copy or move of this source is in progress. Wait for it to finish, then try again."
      );
    }
    for (const key of keys) {
      this.busy.add(key);
    }
    try {
      return await planned.run();
    } finally {
      for (const key of keys) {
        this.busy.delete(key);
      }
    }
  }
}
