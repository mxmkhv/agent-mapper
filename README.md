# agent-mapper

A local, read-only view of Claude Code and Codex configuration. The current build inventories instruction files, skills, and plugin copies in a local web UI.

## Start

1. Select Node **26.7.0** using your version manager. Tooling requires Node **22.22.1 or newer**. On this Mac, the Homebrew Node is available with `export PATH="/opt/homebrew/bin:$PATH"`.
2. Install Bun **1.4.0**, then run `bun install`. This installs exact locked dependencies and sets the repository's Git hooks path to `.githooks`.
3. Run `bun run build`, then `node packages/cli/dist/index.js` to open the local inventory UI.

## Inventory

| Command                                         | Result                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `node packages/cli/dist/index.js`               | Open the local UI with global sources and suggested projects          |
| `node packages/cli/dist/index.js --tools codex` | Open the UI filtered to Codex                                         |
| `node packages/cli/dist/index.js why .`         | Explain expected instruction and skill loading for the current folder |
| `node packages/cli/dist/index.js --json .`      | Export the same resolved inventory as JSON                            |

The UI accepts an explicit folder path, including folders outside home. Select an instruction, skill, hook, plugin, or MCP server to inspect its source and expected state, then Open or Reveal it in macOS. Hooks are grouped by lifecycle area and show the event, matcher, handler type, source locator, flags, and applicability. Handler commands, URLs, and prompts stay in the source file. Plugin detail lists discovered skills, commands, agents, hooks, and MCP declarations. Selected plugin skills, hooks, and MCP declarations link to their inventory views and back. Installation, enablement, cached copies, and unknown version selection have separate states. Counts describe discovered declarations, not runtime capabilities.

Free-form file content stays out of the browser and JSON response; use Open for the full text. The model describes a fresh local CLI session and lists coverage gaps beside the inventory. Hook readers cover Claude settings, Codex `hooks.json` and common inline TOML syntax, and discovered plugin declarations. Skill and agent frontmatter hooks, managed settings, unsupported TOML forms, hook trust decisions, plugin marketplace entry overrides, and live session state are not resolved yet. MCP readers cover Claude user, project-private, and project-shared JSON declarations, Codex user and project TOML declarations, and discovered plugin declarations. MCP credentials, arguments, and full URLs stay in source files; no server is contacted. Account and session connections, managed MCP sources, approval state, and unsupported TOML forms remain outside local coverage. Agents, memory, and worktree comparison are later milestones.

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

After `bun run build`, run `node packages/cli/dist/index.js --help` to see CLI usage. The published CLI is designed to run under Node.

## Agent setup

Claude Code registration is in `.claude/settings.json`; Codex registration is in `.codex/hooks.json`. Both call the same scripts. Restart/reload the harness as needed. In Codex, trust the project and review the definitions in `/hooks`. `AGENTS.md` links to `CLAUDE.md` so both read the same instructions.

[Quality gates and limitations](docs/quality-gates.md) · [Product brief](docs/mvp-v2.md)
