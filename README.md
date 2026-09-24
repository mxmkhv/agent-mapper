# agent-mapper

A local, read-only view of Claude Code and Codex configuration. The workspace and quality gates are bootstrapped; discovery and configuration inventory are not implemented yet.

## Start

1. Select Node **26.7.0** using your version manager. Tooling requires Node **22.22.1 or newer**. On this Mac, the Homebrew Node is available with `export PATH="/opt/homebrew/bin:$PATH"`.
2. Install Bun **1.4.0**, then run `bun install`. This installs exact locked dependencies and sets the repository's Git hooks path to `.githooks`.
3. Run `bun run dev` for the UI scaffold.

The `prepare` script changes only this repository's `core.hooksPath`. CI skips installation. Set `AGENT_MAPPER_SKIP_HOOK_INSTALL=1` only when an external system already manages Git hooks; it does not disable CI checks.

## Commands

| Command              | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `bun run dev`        | Vite development server                               |
| `bun run lint`       | Oxlint, native rules and anti-slop                    |
| `bun run lint:fix`   | Apply available safe lint fixes                       |
| `bun run test:ts`    | TypeScript 7, all workspaces and project tooling      |
| `bun run knip`       | Unused files, exports, and dependencies               |
| `bun run test --run` | Full test suite                                       |
| `bun run test:hooks` | Shared agent-hook and Git-gate integration tests      |
| `bun run format`     | Format project-owned files                            |
| `bun run validate`   | All gates, production builds, and Node CLI smoke test |

After `bun run build`, run `node packages/cli/dist/index.js --help`. The CLI distribution includes the built web assets. It does not serve them yet.

## Agent setup

Claude Code registration is in `.claude/settings.json`; Codex registration is in `.codex/hooks.json`. Both call the same scripts. Restart/reload the harness as needed. In Codex, trust the project and review the definitions in `/hooks`. `AGENTS.md` links to `CLAUDE.md` so both read the same instructions.

[Quality gates and limitations](docs/quality-gates.md) · [Product brief](docs/mvp-v2.md)
