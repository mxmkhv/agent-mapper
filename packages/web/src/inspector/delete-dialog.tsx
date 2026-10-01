import { useEffect, useState } from "react";
import type { SourceDeletePlan, SourceRef } from "@agent-mapper/core";
import { Trash2 } from "lucide-react";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { InventoryRecord } from "../model/record-types";
import { applyDelete, planDelete } from "../source-delete-api";
import { DocumentRequestError } from "../source-document-api";
import { useDocuments } from "../state/use-document-drafts";
import { Button } from "../ui/button";
import { Modal } from "../ui/modal";
import { PathText } from "../ui/path-text";
import { bytesText, Warnings } from "./skill-transfer-preview";

type PlanState =
  | { status: "loading" }
  | { status: "ready"; plan: SourceDeletePlan }
  | { status: "error"; message: string };

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The plan for this item; `refresh` asks again, for example after the item changed under the dialog. */
function usePlan(source: SourceRef) {
  const [state, setState] = useState<PlanState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    planDelete(source, controller.signal).then(
      (plan) => setState({ status: "ready", plan }),
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: messageOf(error) });
        }
      }
    );
    return () => controller.abort();
  }, [source, attempt]);
  return {
    state,
    refresh() {
      setState({ status: "loading" });
      setAttempt((value) => value + 1);
    }
  };
}

function Path({ path, context }: { path: string; context: PathContext }) {
  return (
    <span className="font-mono text-mono break-words">
      <PathText path={tildePath(path, context)} />
    </span>
  );
}

/** One sentence on what goes to the Trash; for a link, also what stays. */
function Summary({
  plan,
  context
}: {
  plan: SourceDeletePlan;
  context: PathContext;
}) {
  if (plan.target === "link" && plan.broken) {
    return (
      <p className="m-0">
        Removes the broken symlink <Path context={context} path={plan.path} />.
        It points to <Path context={context} path={plan.linkTarget ?? ""} />,
        which no longer exists.
      </p>
    );
  }
  if (plan.target === "link") {
    return (
      <p className="m-0">
        Removes the symlink <Path context={context} path={plan.path} />. The{" "}
        {plan.kind === "skill" ? "folder" : "file"} it points to,{" "}
        <Path context={context} path={plan.linkTarget ?? ""} />, stays.
      </p>
    );
  }
  if (plan.target === "file") {
    return (
      <p className="m-0">
        Moves the file <Path context={context} path={plan.path} /> to the Trash.
      </p>
    );
  }
  return (
    <p className="m-0">
      Moves the folder <Path context={context} path={plan.path} /> and{" "}
      {plan.tooLarge
        ? `more than ${plan.files} files (over ${bytesText(plan.totalBytes)})`
        : `its ${plan.files} ${plan.files === 1 ? "file" : "files"} (${bytesText(plan.totalBytes)})`}{" "}
      to the Trash.
    </p>
  );
}

function Body({ state, context }: { state: PlanState; context: PathContext }) {
  if (state.status === "loading") {
    return <output className="text-label text-ink-muted">Checking…</output>;
  }
  if (state.status === "error") {
    return (
      <p className="m-0 text-label text-problem" role="alert">
        {tildeText(state.message, context)}
      </p>
    );
  }
  const { plan } = state;
  return (
    <>
      <Summary context={context} plan={plan} />
      {plan.blocked ? (
        <p className="m-0 text-label text-problem">
          {tildeText(plan.blocked, context)}
        </p>
      ) : null}
      {plan.warnings.length ? (
        <Warnings context={context} warnings={plan.warnings} />
      ) : null}
      {plan.blocked ? null : (
        <p className="m-0 text-label text-ink-muted">
          Changed your mind later? Use Put Back in the Trash.
        </p>
      )}
    </>
  );
}

/** Asks before moving a skill folder or agent file to the Trash, saying exactly what goes and what stays. */
export function DeleteDialog({
  record,
  sourceRef,
  context,
  onClose
}: {
  record: InventoryRecord;
  sourceRef: SourceRef;
  context: PathContext;
  onClose(): void;
}) {
  const { state, refresh } = usePlan(sourceRef);
  const { onMutated } = useDocuments();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const plan =
    state.status === "ready" && !state.plan.blocked ? state.plan : undefined;
  async function remove(ready: SourceDeletePlan) {
    setDeleting(true);
    setError(undefined);
    try {
      await applyDelete({ source: sourceRef, fingerprint: ready.fingerprint });
      onClose();
      onMutated();
    } catch (cause) {
      setDeleting(false);
      setError(messageOf(cause));
      // The item changed since the dialog opened: show what is there now, so Delete acts on what was reviewed.
      if (cause instanceof DocumentRequestError && cause.code === "conflict") {
        refresh();
      }
    }
  }
  return (
    <Modal
      busy={deleting}
      footer={
        <>
          <Button disabled={deleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="text-problem"
            disabled={!plan || deleting}
            onClick={() => plan && void remove(plan)}
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </>
      }
      onClose={onClose}
      title={`Delete ${record.name}?`}
    >
      <Body context={context} state={state} />
      {error ? (
        <p className="m-0 text-label text-problem" role="alert">
          {tildeText(error, context)}
        </p>
      ) : null}
    </Modal>
  );
}

/** The inspector's Delete, which opens the dialog. */
export function DeleteButton(props: {
  record: InventoryRecord;
  sourceRef: SourceRef;
  context: PathContext;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.8} />
        Delete
      </Button>
      {open ? <DeleteDialog {...props} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
