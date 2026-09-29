# agent-mapper

A local view of Claude Code and Codex configuration. The current build inventories local instructions, skills, agents, hooks, plugins, MCP declarations, memory files, and linked worktrees. Scans are read-only; the only writes are instruction and skill edits you review and save explicitly.

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

Press `⌘K` or click Search to find inventory items by name or source path across tabs. The context cards separate approximate startup text, skill metadata text, and available on-demand text for each tool.

The Findings tab reports broken source links, unreadable files, shadowed instructions, missing plugin files, long instructions, and exact repeated paragraphs in expected startup sources. Findings link to their sources. The 200-line threshold is a review prompt, not a tool limit; repeated paragraph text stays out of JSON and the browser response.

The UI accepts an explicit folder path, including folders outside home. Select an instruction, skill, agent, hook, plugin, MCP server, or memory file to inspect its source and expected state, then Open or Reveal it in macOS. Hooks are grouped by lifecycle area and show the event, matcher, handler type, source locator, flags, and applicability. Handler commands, URLs, and prompts stay in the source file. Plugin detail lists discovered skills, commands, agents, hooks, and MCP declarations. Selected plugin skills, agents, hooks, and MCP declarations link to their inventory views and back. Installation, enablement, cached copies, and unknown version selection have separate states. Counts describe discovered declarations, not runtime capabilities.

Inventory responses, `why` and `--json` keep free-form file content out; use Open for the full text. The one exception is the instruction or skill you select: its full, unredacted text is sent to the local browser page so you can preview and edit it. The model describes a fresh local CLI session and lists coverage gaps beside the inventory.

Hook readers cover local Claude and Codex settings, discovered plugin declarations, local managed Claude settings, and skill and agent frontmatter. Unsupported declaration shapes, hook trust decisions, remote policy, plugin marketplace entry overrides, and live session state remain unverified. MCP readers cover Claude user, project, plugin, and local managed declarations, plus Codex user, project, and plugin declarations. MCP credentials, arguments, and full URLs stay in source files; no server is contacted. Account and session connections, approval state, remote policy, and unsupported declaration fields remain outside local coverage.

The Memory tab lists local Markdown files with size, line count, modified time, and read state. Claude project folder matches remain candidates because the encoded names can collide. Memory text stays in source files. The Agents tab lists local Claude Markdown and Codex TOML declarations and linked Claude plugin agents. It keeps agent instructions in source files; managed and session agents, unsupported declarations, Codex project trust, and live use remain outside local coverage. The Worktrees tab compares project configuration files in a linked checkout with the main checkout, shows Git tracking status when known, and leaves inherited global configuration out of the comparison. File contents stay local; a changed settings file does not identify which declaration inside it changed.

## Editing instructions and skills

Select an instruction (`CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENTS.override.md`) or a `SKILL.md` to preview it in the inspector. **Edit** opens the file in a full-width editor; **Review changes** (or `⌘S`) shows the exact diff, frontmatter checks, and the contexts this server has scanned that use the file. Only **Save changes** writes, and only the reviewed text.

- **Editable:** existing, user-owned files discovered in global or project scope, up to 1 MiB, UTF-8 with one line-ending style. Plugin files, managed configuration, hard-linked files, files owned by another user, and files in unwritable folders open read-only with the reason.
- **Symlinks:** saving writes the real file, so every path that links to it changes; the link itself stays a link. The review lists known aliases.
- **Conflicts:** if the file changed on disk since you opened it, nothing is written. Your draft stays; compare it with the current file, then drop it or continue editing and review again. This is optimistic detection: an editor writing in the moment between the final check and the rename can still be overwritten.
- **History:** before each save or restore, the replaced bytes are stored in `~/Library/Application Support/agent-mapper/revisions/` (Linux: `$XDG_DATA_HOME/agent-mapper/revisions` or `~/.local/share/agent-mapper/revisions`), private to your user and never pruned automatically. **History** restores any snapshot exactly and records the displaced version, so a restore can be undone. A version that was saved and then overwritten by another editor is not captured.
- **Metadata:** a save replaces the file. Text, symlinks, and permission mode are kept; macOS extended attributes, ACLs, Finder tags, and the original creation date are not.
- **Drafts:** unsaved edits survive switching views, tools, and projects (see **Drafts** in the header), but live only in the open tab. Reloading asks first; restarting the server ends the session, so copy a draft before reopening the new URL.
- **Locks:** a save that finds `lock` in a file's history folder reports it as busy. If no agent-mapper server is running, delete that lock file.
- Running Claude Code or Codex sessions may need a restart to pick up a saved file.

This extends the read-only [product brief](docs/mvp-v2.md) with explicit writes, as agreed in [#10](https://github.com/mxmkhv/agent-mapper/issues/10).

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

[Quality gates and limitations](docs/quality-gates.md) · [Provider verification](docs/provider-verification.md) · [Product brief](docs/mvp-v2.md)
