# Provider verification

Checked on 2026-09-28 with locally installed Claude Code 2.1.283 (`claude --version`) and Codex CLI 0.158.0 (`codex --version`). The resolver fixtures cover default instruction paths, ancestor application, `.claude/CLAUDE.md`, Codex same-folder overrides, empty Codex files, and Claude's project `AGENTS.md` fallback across the folder chain. The findings fixtures cover exact repeated startup paragraphs, short-fragment exclusion, broken links, missing imports, and the 200-line review threshold.

The rules were compared with the [Claude Code memory documentation](https://code.claude.com/docs/en/memory) and [Codex AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Installed CLI version and help output were checked locally.

Controlled Claude runs used temporary folders, `claude -p --no-session-persistence --setting-sources project --settings '{"disableAllHooks":true}' --tools ''`, and `/context` to inspect the Memory Files list. A `CLAUDE.md` importing `docs/first.md`, which imported `second.md`, listed all three files. With tools disabled, Claude also answered with the verification word present only in `second.md`. An `AGENTS.md` import likewise appeared in `/context` when no `CLAUDE.md` existed. Adding `CLAUDE.md` made `/context` list that file alone, matching the mapper's shadowed `AGENTS.md` result.

On 2026-09-30, Claude Code 2.1.285 was checked for the `AGENTS.md` fallback across folders. Runs started in `parent/child`, a Git root, with `--setting-sources project` unless noted:

| Files                                                                 | `/context` Memory Files                       |
| --------------------------------------------------------------------- | --------------------------------------------- |
| `parent/AGENTS.md`                                                    | `parent/AGENTS.md`                            |
| `parent/AGENTS.md`, `parent/child/CLAUDE.md`                          | `parent/child/CLAUDE.md`                      |
| `parent/CLAUDE.md`, `parent/child/AGENTS.md`                          | `parent/CLAUDE.md`                            |
| `parent/AGENTS.md`, `parent/child/CLAUDE.local.md`                    | `parent/child/CLAUDE.local.md`                |
| `parent/AGENTS.md`, `parent/child/.claude/CLAUDE.md`                  | `parent/child/.claude/CLAUDE.md`              |
| `parent/AGENTS.md`, `parent/child/AGENTS.md`                          | Both `AGENTS.md` files                        |
| `parent/child/AGENTS.md`, user `~/.claude/CLAUDE.md` (`user,project`) | User `CLAUDE.md` and `parent/child/AGENTS.md` |

The fallback applies to the whole folder chain. One project `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` anywhere from the working directory up drops every `AGENTS.md`. The user `CLAUDE.md` does not count. The mapper marks those `AGENTS.md` files as shadowed.

The form `@agent-detail.md.` did not add the referenced file to `/context`, even when a file named `agent-detail.md.` existed. Removing the final period made it appear. The mapper records punctuation-ended tokens as syntax unknown and does not claim a loaded or missing import. This result covers Claude Code 2.1.283 only. External import approval, custom instruction-file settings, other versions, and existing session reloads remain unverified.

With `CLAUDE_CONFIG_DIR` set to a temporary absolute directory, `/context` listed that directory's `CLAUDE.md` as User memory. A relative value resolved from the Claude process's working directory. Claude also created `.claude.json` inside the custom directory. The mapper uses that root for user instructions, skills, commands, agents, hooks, plugins, memory, and Claude's local MCP state. This checks the behavior of Claude Code 2.1.283 and agrees with the [environment variable reference](https://code.claude.com/docs/en/env-vars).

Run `bun run test --run packages/core/src/inventory.test.ts packages/cli/src/service.test.ts packages/cli/src/findings.test.ts packages/cli/src/instruction-imports.test.ts` to repeat the local fixtures. To inspect a local folder, run `node packages/cli/dist/index.js`, then select it under Projects or enter its absolute path with Add folder… in the sidebar.
