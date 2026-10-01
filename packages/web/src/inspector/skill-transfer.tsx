import { useMemo, useState } from "react";
import type {
  SkillTransferMode,
  SkillTransferRequest,
  SkillTransferResult,
  SourceRef,
  ToolId
} from "@agent-mapper/core";
import { Copy } from "lucide-react";
import { SegmentedToggle } from "../documents/segmented-toggle";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { CopyTarget } from "../model/copy-targets";
import type { InventoryRecord } from "../model/record-types";
import { useDocuments } from "../state/use-document-drafts";
import {
  useTransferApply,
  useTransferPlan,
  type PlanState
} from "../state/use-skill-transfer";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import {
  PlanPreview,
  ProjectPicker,
  ToolPicker
} from "./skill-transfer-preview";

interface SkillTransferProps {
  record: InventoryRecord;
  sourceRef: SourceRef;
  copyTargets: readonly CopyTarget[];
  context: PathContext;
  scannedAt: string;
  /** Shows the moved skill in its new place once the rescan lists it. */
  onSelect(id: string, options: { tool: ToolId }): void;
}

interface DialogProps extends SkillTransferProps {
  onClose(): void;
}

interface FormProps extends DialogProps {
  /** Only a project's own skill can leave its project. */
  canMove: boolean;
  onDone(result: SkillTransferResult): void;
}

const modes: { value: SkillTransferMode; label: string }[] = [
  { value: "copy", label: "Copy to project" },
  { value: "promote", label: "Move to global" }
];

const ready = (state: PlanState) =>
  state.status === "ready" &&
  !state.plan.blocked &&
  state.plan.destinations.every((item) => !item.conflict)
    ? state.plan
    : undefined;

function useRequest(sourceRef: SourceRef, tool: InventoryRecord["tool"]) {
  const [mode, setMode] = useState<SkillTransferMode>("copy");
  const [projectPath, setProjectPath] = useState("");
  const [tools, setTools] = useState<ToolId[]>(
    tool === "unknown" ? [] : [tool]
  );
  const request = useMemo<SkillTransferRequest | undefined>(
    () =>
      !tools.length || (mode === "copy" && !projectPath)
        ? undefined
        : {
            source: sourceRef,
            mode,
            projectPath: mode === "copy" ? projectPath : undefined,
            tools
          },
    [mode, projectPath, sourceRef, tools]
  );
  return {
    request,
    mode,
    setMode,
    projectPath,
    setProjectPath,
    tools,
    setTools
  };
}

function TransferForm(props: FormProps) {
  const { record, context, canMove } = props;
  const choice = useRequest(props.sourceRef, record.tool);
  const preview = useTransferPlan(choice.request, props.scannedAt);
  const run = useTransferApply({
    request: choice.request,
    recheck: preview.recheck,
    onDone: props.onDone
  });
  const plan = ready(preview.state);
  const copying = choice.mode === "copy";
  // A project's own skill is already in its project; offering that folder only leads to a conflict.
  const targets = canMove
    ? props.copyTargets.filter(
        (target) => target.path !== props.sourceRef.workingDirectory
      )
    : props.copyTargets;
  const action = copying
    ? { idle: "Copy", busy: "Copying…" }
    : { idle: "Move to global", busy: "Moving…" };
  return (
    <Modal
      busy={run.applying}
      footer={
        <>
          <Button disabled={run.applying} onClick={props.onClose}>
            Cancel
          </Button>
          <Button
            disabled={!plan || run.applying}
            onClick={() => plan && void run.apply(plan)}
            variant="primary"
          >
            {run.applying ? action.busy : action.idle}
          </Button>
        </>
      }
      onClose={props.onClose}
      title={
        copying
          ? `Copy ${record.name} to a project`
          : `Move ${record.name} to global`
      }
    >
      {canMove ? (
        <div>
          <SegmentedToggle<SkillTransferMode>
            label="Copy or move"
            onChange={choice.setMode}
            options={modes}
            value={choice.mode}
          />
        </div>
      ) : null}
      {copying ? (
        <ProjectPicker
          onChange={choice.setProjectPath}
          targets={targets}
          value={choice.projectPath}
        />
      ) : null}
      <ToolPicker onChange={choice.setTools} value={choice.tools} />
      <PlanPreview context={context} state={preview.state} />
      {run.error ? (
        <p className="m-0 text-label text-problem" role="alert">
          {tildeText(run.error, context)}
        </p>
      ) : null}
    </Modal>
  );
}

/** A copy, or a move that could not finish cleanly, reports here; a clean move shows the new skill instead. */
function Finished({
  result,
  context
}: {
  result: SkillTransferResult;
  context: PathContext;
}) {
  return (
    <output className="grid gap-2 text-label">
      <span className="text-caption font-semibold text-ink-muted">Created</span>
      <ul className="m-0 grid list-none gap-1 p-0">
        {result.created.map((item) => (
          <li className="font-mono text-mono break-words" key={item.path}>
            {tildePath(item.path, context)}
          </li>
        ))}
      </ul>
      {result.warnings.map((warning) => (
        <span className="text-problem" key={warning}>
          {tildeText(warning, context)}
        </span>
      ))}
    </output>
  );
}

/** The copy-or-move dialog on its own, for callers that bring their own trigger. */
export function SkillTransferDialog(props: DialogProps) {
  const { record, onClose } = props;
  const { onMutated } = useDocuments();
  const [finished, setFinished] = useState<SkillTransferResult>();
  function done(result: SkillTransferResult) {
    onMutated();
    if (result.mode === "copy" || result.warnings.length) {
      setFinished(result);
      return;
    }
    onClose();
    const moved =
      result.created.find((item) => item.tool === record.tool) ??
      result.created[0];
    if (moved) {
      props.onSelect(moved.entryId, { tool: moved.tool });
    }
  }
  if (finished) {
    return (
      <Modal
        footer={
          <Button onClick={onClose} variant="primary">
            Done
          </Button>
        }
        onClose={onClose}
        title={`Copied ${record.name}`}
      >
        <Finished context={props.context} result={finished} />
      </Modal>
    );
  }
  return (
    <TransferForm
      {...props}
      canMove={
        record.kind === "skill" && record.layer === "project" && !record.plugin
      }
      onDone={done}
    />
  );
}

/** Copy a skill folder or an agent file into a project, or move a project's own skill to the global folders. */
export function SkillTransfer(props: SkillTransferProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Copy aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
        Copy
      </Button>
      {open ? (
        <SkillTransferDialog {...props} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
