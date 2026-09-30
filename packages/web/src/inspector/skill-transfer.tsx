import { useMemo, useState } from "react";
import type {
  SkillTransferMode,
  SkillTransferRequest,
  SkillTransferResult,
  SourceRef,
  ToolId
} from "@agent-mapper/core";
import { ArrowUpToLine, Copy } from "lucide-react";
import { ConfirmButton } from "../documents/confirm-button";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { useDocuments } from "../state/use-document-drafts";
import {
  useTransferApply,
  useTransferPlan,
  type PlanState
} from "../state/use-skill-transfer";
import { Button } from "../ui/button";
import { Section } from "./inspector-sections";
import {
  PlanPreview,
  ProjectPicker,
  ToolPicker
} from "./skill-transfer-preview";

interface SkillTransferProps {
  record: InventoryRecord;
  sourceRef: SourceRef;
  projectPaths: readonly string[];
  context: PathContext;
  scannedAt: string;
  /** Shows the moved skill in its new place once the rescan lists it. */
  onSelect(id: string, options: { tool: ToolId }): void;
}

interface FormProps extends SkillTransferProps {
  mode: SkillTransferMode;
  onCancel(): void;
  onDone(result: SkillTransferResult): void;
}

const ready = (state: PlanState) =>
  state.status === "ready" &&
  !state.plan.blocked &&
  state.plan.destinations.every((item) => !item.conflict)
    ? state.plan
    : undefined;

function useRequest(props: FormProps) {
  const { mode, sourceRef, record } = props;
  const [projectPath, setProjectPath] = useState("");
  const [tools, setTools] = useState<ToolId[]>(
    record.tool === "unknown" ? [] : [record.tool]
  );
  const request = useMemo<SkillTransferRequest | undefined>(
    () =>
      mode === "copy" && !projectPath
        ? undefined
        : {
            source: sourceRef,
            mode,
            projectPath: mode === "copy" ? projectPath : undefined,
            tools
          },
    [mode, projectPath, sourceRef, tools]
  );
  return { request, projectPath, setProjectPath, tools, setTools };
}

function TransferForm(props: FormProps) {
  const { mode, context } = props;
  const choice = useRequest(props);
  const preview = useTransferPlan(choice.request, props.scannedAt);
  const run = useTransferApply({
    request: choice.request,
    recheck: preview.recheck,
    onDone: props.onDone
  });
  const plan = ready(preview.state);
  return (
    <div className="grid gap-3 rounded-card border border-hairline p-3">
      {mode === "copy" ? (
        <ProjectPicker
          onChange={choice.setProjectPath}
          projects={props.projectPaths}
          value={choice.projectPath}
        />
      ) : (
        <p className="m-0 text-label text-ink-muted">
          Moves this folder into the global skills folder of each tool and
          removes it from the project.
        </p>
      )}
      <ToolPicker onChange={choice.setTools} value={choice.tools} />
      <PlanPreview context={context} state={preview.state} />
      {run.error ? (
        <p className="m-0 text-label text-problem" role="alert">
          {tildeText(run.error, context)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {mode === "copy" ? (
          <Button
            disabled={!plan || run.applying}
            onClick={() => plan && void run.apply(plan)}
            variant="primary"
          >
            {run.applying ? "Copying…" : "Copy"}
          </Button>
        ) : (
          <ConfirmButton
            confirmLabel="Move"
            disabled={!plan || run.applying}
            label={run.applying ? "Moving…" : "Move to global"}
            onConfirm={() => plan && void run.apply(plan)}
            question="Remove it from this project?"
          />
        )}
        <Button disabled={run.applying} onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** A copy, or a move that could not finish cleanly, stays on screen; a clean move shows the new skill. */
function Finished({
  result,
  context
}: {
  result: SkillTransferResult;
  context: PathContext;
}) {
  return (
    <output className="mt-2 grid gap-1 text-label">
      <span>
        Copied to{" "}
        {result.created.map((item, index) => (
          <span key={item.path}>
            {index ? " and " : ""}
            <span className="font-mono text-mono break-words">
              {tildePath(item.path, context)}
            </span>
          </span>
        ))}
        .
      </span>
      {result.warnings.map((warning) => (
        <span className="text-problem" key={warning}>
          {tildeText(warning, context)}
        </span>
      ))}
    </output>
  );
}

/** Copy a skill folder into a project, or move a project's own skill to the global folders. */
export function SkillTransfer(props: SkillTransferProps) {
  const { record } = props;
  const { onMutated } = useDocuments();
  const [mode, setMode] = useState<SkillTransferMode>();
  const [finished, setFinished] = useState<SkillTransferResult>();
  const canMove = record.layer === "project" && !record.plugin;
  function done(result: SkillTransferResult) {
    setMode(undefined);
    onMutated();
    if (result.mode === "copy" || result.warnings.length) {
      setFinished(result);
      return;
    }
    const moved =
      result.created.find((item) => item.tool === record.tool) ??
      result.created[0];
    if (moved) {
      props.onSelect(moved.entryId, { tool: moved.tool });
    }
  }
  function open(next: SkillTransferMode) {
    setFinished(undefined);
    setMode(next);
  }
  return (
    <Section title="Copy or move">
      {mode ? (
        <TransferForm
          {...props}
          mode={mode}
          onCancel={() => setMode(undefined)}
          onDone={done}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => open("copy")}>
            <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
            Copy to project…
          </Button>
          {canMove ? (
            <Button onClick={() => open("promote")}>
              <ArrowUpToLine
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={1.8}
              />
              Move to global…
            </Button>
          ) : null}
        </div>
      )}
      {finished ? <Finished context={props.context} result={finished} /> : null}
    </Section>
  );
}
