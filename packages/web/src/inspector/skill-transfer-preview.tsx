import type { SkillTransferPlan, ToolId } from "@agent-mapper/core";
import type { CopyTarget } from "../model/copy-targets";
import { tildePath, tildeText, type PathContext } from "../model/paths";
import type { PlanState } from "../state/use-skill-transfer";
import { ToolGlyph, toolName } from "../ui/marks";
import { PathText } from "../ui/path-text";

const kilobyte = 1024;
const megabyte = kilobyte * kilobyte;
const tools: ToolId[] = ["claude", "codex"];

function bytesText(bytes: number): string {
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
  return (
    <label className="grid gap-1 text-caption font-semibold text-ink-muted">
      Project
      <select
        className="h-7 min-w-0 rounded-control border border-hairline bg-surface px-1.5 text-label font-normal text-ink"
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
      <legend className="mb-1 p-0 text-caption font-semibold text-ink-muted">
        For
      </legend>
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
    </fieldset>
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
  if (state.status === "loading") {
    return <output className="text-label text-ink-muted">Checking…</output>;
  }
  if (state.status === "error") {
    return (
      <p className="m-0 text-label text-problem" role="alert">
        {state.message}
      </p>
    );
  }
  const { plan } = state;
  return (
    <div className="grid gap-2">
      <Destinations context={context} plan={plan} />
      <Files plan={plan} />
      {plan.blocked ? (
        <p className="m-0 text-label text-problem">
          {tildeText(plan.blocked, context)}
        </p>
      ) : null}
      {plan.warnings.length ? (
        <ul className="m-0 grid list-none gap-1 p-0 text-label text-ink-muted">
          {plan.warnings.map((warning) => (
            <li key={warning}>{tildeText(warning, context)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
