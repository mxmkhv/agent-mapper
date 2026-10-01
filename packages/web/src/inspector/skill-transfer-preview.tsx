import type { ReactNode } from "react";
import type { SkillTransferPlan, ToolId } from "@agent-mapper/core";
import { TriangleAlert } from "lucide-react";
import type { CopyTarget } from "../model/copy-targets";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { PlanState } from "../state/use-skill-transfer";
import { ToolGlyph, toolName } from "../ui/marks";
import { PathText } from "../ui/path-text";

const kilobyte = 1024;
const megabyte = kilobyte * kilobyte;
const tools: ToolId[] = ["claude", "codex"];
const fieldLabel = "text-caption font-semibold text-ink-muted";

export function bytesText(bytes: number): string {
  if (bytes < kilobyte) {
    return `${bytes} B`;
  }
  return bytes < megabyte
    ? `${(bytes / kilobyte).toFixed(1)} KB`
    : `${(bytes / megabyte).toFixed(1)} MB`;
}

export function ProjectPicker({
  targets,
  value,
  onChange
}: {
  targets: readonly CopyTarget[];
  value: string;
  onChange(path: string): void;
}) {
  if (!targets.length) {
    return (
      <p className="m-0 text-label text-ink-muted">
        No other project to copy into. Add one with “Add folder…” in the
        sidebar.
      </p>
    );
  }
  return (
    <label className={`grid gap-1 ${fieldLabel}`}>
      To project
      <select
        className="h-8 min-w-0 rounded-control border border-hairline bg-surface px-2 text-label font-normal text-ink"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Choose a project</option>
        {targets.map((target) => (
          <option key={target.path} title={target.path} value={target.path}>
            {target.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToolPicker({
  value,
  onChange
}: {
  value: readonly ToolId[];
  onChange(tools: ToolId[]): void;
}) {
  return (
    <fieldset className="m-0 grid gap-1 border-0 p-0">
      <legend className={`mb-1 p-0 ${fieldLabel}`}>For</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {tools.map((tool) => (
          <label className="flex items-center gap-1.5 text-label" key={tool}>
            <input
              checked={value.includes(tool)}
              className="accent-ink"
              onChange={(event) =>
                onChange(
                  tools.filter((item) =>
                    item === tool ? event.target.checked : value.includes(item)
                  )
                )
              }
              type="checkbox"
            />
            <ToolGlyph tool={tool} />
            {toolName[tool]}
          </label>
        ))}
      </div>
      {value.length ? null : (
        <p className="m-0 text-label text-ink-muted">
          Choose at least one tool.
        </p>
      )}
    </fieldset>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className={fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function Destinations({
  plan,
  context
}: {
  plan: SkillTransferPlan;
  context: PathContext;
}) {
  return (
    <ul className="m-0 grid list-none gap-1.5 p-0">
      {plan.destinations.map((destination) => (
        <li className="grid gap-0.5" key={destination.path}>
          <span className="flex items-start gap-1.5">
            <ToolGlyph tool={destination.tool} />
            <span className="min-w-0 font-mono text-mono break-words">
              <PathText path={tildePath(destination.path, context)} />
            </span>
          </span>
          {destination.conflict ? (
            <span className="pl-5 text-caption text-problem">
              {tildeText(destination.conflict, context)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Files({ plan }: { plan: SkillTransferPlan }) {
  const files = plan.files.filter((file) => file.type !== "directory");
  return (
    <details className="text-label">
      <summary className="cursor-pointer text-ink-muted">
        {files.length} {files.length === 1 ? "file" : "files"} ·{" "}
        {bytesText(plan.totalBytes)}
      </summary>
      <ul className="m-0 mt-1 grid list-none gap-0.5 p-0 font-mono text-mono">
        {files.map((file) => (
          <li className="break-words" key={file.path}>
            {file.path}
            {file.type === "symlink" ? " (link)" : ""}
            {file.executable && file.type === "file" ? " (executable)" : ""}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Things that will still happen, or break, if the user goes ahead. */
export function Warnings({
  warnings,
  context
}: {
  warnings: readonly string[];
  context: PathContext;
}) {
  return (
    <div className="flex gap-2 rounded-panel bg-wash px-3 py-2.5 text-label">
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-3.5 shrink-0 text-ink-muted"
        strokeWidth={1.8}
      />
      <ul className="m-0 grid list-none gap-1 p-0">
        {warnings.map((warning) => (
          <li key={warning}>{tildeText(warning, context)}</li>
        ))}
      </ul>
    </div>
  );
}

function Plan({
  plan,
  context
}: {
  plan: SkillTransferPlan;
  context: PathContext;
}) {
  return (
    <>
      <Group label="Creates">
        <Destinations context={context} plan={plan} />
        <Files plan={plan} />
      </Group>
      {plan.mode === "promote" && !plan.blocked ? (
        <Group label="Removes from the project">
          <span className="font-mono text-mono break-words">
            <PathText path={tildePath(plan.sourceFolder, context)} />
          </span>
        </Group>
      ) : null}
      {plan.blocked ? (
        <p className="m-0 text-label text-problem">
          {tildeText(plan.blocked, context)}
        </p>
      ) : null}
      {plan.warnings.length ? (
        <Warnings context={context} warnings={plan.warnings} />
      ) : null}
    </>
  );
}

/** Where the skill would go, what would stop it, and what another tool may read differently. */
export function PlanPreview({
  state,
  context
}: {
  state: PlanState;
  context: PathContext;
}) {
  if (state.status === "idle") {
    return null;
  }
  if (state.status === "error") {
    return (
      <p className="m-0 text-label text-problem" role="alert">
        {state.message}
      </p>
    );
  }
  const plan = state.status === "ready" ? state.plan : state.previous;
  if (!plan) {
    return <output className="text-label text-ink-muted">Checking…</output>;
  }
  const checking = state.status === "loading";
  return (
    <div
      aria-busy={checking}
      className={`grid gap-3 ${checking ? "opacity-50" : ""}`}
    >
      <Plan context={context} plan={plan} />
    </div>
  );
}
