# agent-mapper

Read-only local configuration inventory for Claude Code and Codex. Product scope: [MVP v2](docs/mvp-v2.md).

## Workspace

- `packages/core`: shared model and resolution logic. No Node, Bun, or UI imports.
- `packages/cli`: Node-compatible CLI, filesystem access, and eventually the local server.
- `packages/web`: React + Vite + Tailwind UI.
- `.agent-hooks`: shared quality-gate scripts for Claude Code and Codex.

Use Bun only for dependencies and package scripts. Pin exact versions; commit `bun.lock`. Node executes the published CLI. See `.node-version` and `.bun-version` for the toolchain.

## Quality gates

- Before edits/shell calls: reject common non-Bun package-manager commands and protected gate writes.
- After edits: Oxlint on edited files. After shell calls: Oxlint on all changed source files, including untracked files.
- Stop/SubagentStop: changed-file Oxlint and workspace typechecking. Feedback requests one continuation; rerun failed checks after fixing them.
- Pre-commit: staged formatting and Oxlint, then typechecking.
- Pre-push and CI: formatting, Oxlint, typechecking, Knip, full Vitest suite, build, and Node CLI smoke test.

Run targeted tests for changed behavior. Avoid repeating full checks when hooks just passed. If hooks are unavailable, skipped, or timed out, run the checks yourself. Never claim a hook passed without evidence.

Gate configuration and `tools/oxlint/` are protected against common accidental writes. Ask Max before changing rules or the hooks themselves. Do not add suppression comments to make failures disappear. Add new rules only to address an agreed need.

Hook protocols and shell protection have limits. See [quality gates](docs/quality-gates.md). Codex project hooks require project trust and hook review via `/hooks`; hook installation alone does not establish trust.

## Code

Use strict TypeScript and named exports for application code. Keep interfaces specific. Handle errors with an actionable message or propagate them. Use theme tokens and inspect changed UI in light and dark mode. Preserve useful explanations of non-obvious provider behavior.

## Git

Commit: `<type>: <description>`, lowercase imperative, no period.
Types: feat, fix, refactor, chore, docs, style, test, perf, ci, build.
Branches: `<type>/<short-slug>` in kebab-case. PRs target `dev`; squash on merge.
