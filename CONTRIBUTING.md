# Contributing

## Setup

1. Install Node **26.7.0** (see `.node-version`). Tooling needs Node 22.22.1 or newer; the published CLI needs Node 22.
2. Install Bun **1.4.0** (see `.bun-version`).
3. Run `bun install`. It installs the locked dependencies and points this repository's Git hooks at `.githooks`.
4. Run `bun run build`, then `node packages/cli/dist/index.js` to open the UI.

Bun manages dependencies and scripts; Node runs the published CLI. Dependency versions are pinned exactly and `bun.lock` is committed.

## Workspace

| Package         | Responsibility                                                  |
| --------------- | --------------------------------------------------------------- |
| `packages/core` | Shared model and resolution logic. No Node, Bun, or UI imports. |
| `packages/cli`  | Node CLI, filesystem readers, local server, and npm package.    |
| `packages/web`  | React + Vite + Tailwind UI, bundled into the CLI.               |
| `.agent-hooks`  | Quality-gate scripts shared by Claude Code and Codex.           |

## Commands

| Command              | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `bun run dev`        | Vite development server                               |
| `bun run build`      | Build core, web, and the CLI                          |
| `bun run lint`       | Oxlint, native rules and anti-slop                    |
| `bun run lint:fix`   | Apply available safe lint fixes                       |
| `bun run format`     | Format project-owned files                            |
| `bun run test:ts`    | TypeScript, all workspaces and project tooling        |
| `bun run knip`       | Unused files, exports, and dependencies               |
| `bun run test --run` | Full test suite                                       |
| `bun run test:hooks` | Agent-hook and Git-gate integration tests             |
| `bun run validate`   | All gates, production builds, and Node CLI smoke test |

## Quality gates

| Layer          | Trigger                            | Checks                                                            |
| -------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Guard          | Agent edit and shell calls         | Blocks non-Bun package-manager commands and writes to gate config |
| Edit feedback  | Agent edits                        | Oxlint on edited files                                            |
| Shell feedback | Agent shell calls                  | Oxlint on all changed and untracked source files                  |
| Completion     | Agent Stop / SubagentStop          | Changed-file Oxlint and workspace typecheck                       |
| Commit         | Git pre-commit                     | Staged formatting and Oxlint, then typecheck                      |
| Push           | Git pre-push                       | `bun run validate`                                                |
| CI             | PRs and pushes to `main` and `dev` | `bun run validate` on Linux and macOS                             |

Limits worth knowing:

- The guard prevents common mistakes; it is not a security boundary. Computed paths or other interpreters can get past it.
- The completion hook asks for one continuation, then lets the agent stop. Rerun failed checks after fixing them.
- A hook that times out has not passed. Run the check yourself.
- `AGENT_STOP_TYPECHECK=0` skips only the completion typecheck. Git and CI still typecheck.
- `AGENT_MAPPER_SKIP_HOOK_INSTALL=1` skips Git hook installation, for setups where another tool manages Git hooks. CI checks still run.

Lint rules, hook scripts, and `tools/oxlint/` are protected. Open an issue before proposing changes to them.

### Agent hooks

Claude Code registers the hooks in `.claude/settings.json`; Codex registers them in `.codex/hooks.json`. Both call the same scripts. `AGENTS.md` is a symlink to `CLAUDE.md`, so both tools read the same instructions.

After cloning, reload the harness. In Codex, trust the project and review the hook definitions in `/hooks`; installing the hooks does not establish trust.

## Branches and pull requests

- Branch from `dev` as `<type>/<short-slug>`, for example `fix/login-redirect`.
- Commit as `<type>: <description>`, lowercase and imperative. Types: feat, fix, refactor, chore, docs, style, test, perf, ci, build.
- Open pull requests against `dev`. They are squash-merged.
- Include screenshots in light and dark mode for UI changes.

## Release

Run `bun run release:patch`, `release:minor`, or `release:major` from a clean tree with an authenticated `gh`. The script:

1. Branches `release/x.y.z` from `origin/dev`.
2. Bumps `packages/cli/package.json` and pushes. The pre-push hook runs the full validate.
3. Opens a pull request into `main`.

Merge the release PR with **Create a merge commit**. The workflow rejects squash and rebase merges, because `dev` could then no longer merge `main` cleanly. Merging runs [the release workflow](.github/workflows/release.yml): it validates, publishes to npm with provenance through trusted publishing, creates the `vx.y.z` GitHub release, and pushes the merge back to `dev`. Branch protection on `dev` must let GitHub Actions push that merge.

**First release:** npm configures trusted publishing only on an existing package, so the first version is published by hand. Check out the release branch, run `bun run build`, then run `npm publish --access public` in `packages/cli`. On npmjs.com, add a GitHub Actions trusted publisher for `mxmkhv/agent-mapper` with workflow `release.yml`, then merge the release PR. The workflow skips the already published version and still creates the GitHub release.
