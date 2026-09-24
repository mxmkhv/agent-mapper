# agent-mapper: MVP

Status: Draft
Platform: macOS first, CLI + local web UI
Tool facts checked against official docs on 2026-09-24 (see Tool reference)

## Goal

Map every agent setting across Claude Code, Codex, OpenCode, and Cursor and show it in a way that makes useless and duplicated instructions easy to spot.

The app is read-only. Files stay where they are. The only actions are **Open in editor** and **Reveal in Finder**.

## Scope

| In | Out (later) |
| --- | --- |
| Instruction files and what loads where | In-app editing, schema validation |
| Skills and commands (sorted, scope badge) | Templates, creating items |
| Agents | Linking into other tools |
| Hooks | Sync / conversion between tools |
| Memory files | Archive / disable-to-test workflow |
| Usage evidence from session logs | Hook latency |
| Always-loaded vs on-demand cost | Content smells, growth history (see Later) |
| Stale references | |
| Symlink visibility | Electron / Tauri wrapper |
| Duplicate and problem detection | MCP and permissions dashboards |
| Open in editor, Reveal in Finder | Plugin management |

## Key finding: tools read each other's folders

The docs show that locations are shared, not owned by one tool:

- `.agents/skills/` is read by Codex, OpenCode, and Cursor.
- `.claude/skills/` is read by Claude Code, OpenCode, and Cursor.
- `.claude/agents/` is read by Claude Code and Cursor.
- `.codex/agents/` is read by Codex and Cursor.
- Hooks in `.claude/settings*.json` run in Claude Code **and** Cursor.
- `CLAUDE.md` is read by Claude Code, by OpenCode as a fallback, and by the Cursor CLI.
- `AGENTS.md` is read by Codex, OpenCode, and Cursor, and by Claude Code as a fallback.

So the core model is **location → set of tools that read it**, not tool → its folders. Every row in the UI shows the tools that actually see it. The same skill in `.claude/skills/` and `.agents/skills/` shows up twice for OpenCode and Cursor, which is one of the duplicates this tool exists to catch.

## Install and first run

```sh
npx agent-mapper
```

1. The CLI asks which tools you use. Tools it detects on the machine are pre-selected:

   ```
   Which agents do you use?
     [x] Claude Code   ~/.claude found
     [x] Codex         ~/.codex found
     [x] OpenCode      ~/.config/opencode found
     [x] Cursor        ~/.cursor found
   ```

   A tool counts as detected if its global folder exists or its binary is on `PATH` (`claude`, `codex`, `opencode`, `cursor-agent`).
2. The CLI searches `~` for tool folders and instruction files (see Discovery). This takes well under a second.
3. It shows the repos it found, grouped under their parent folder, all pre-selected:

   ```
   Found instruction files in 3 repos:
     ~/Developer
       [x] pinchi-mobile      AGENTS.md, CLAUDE.md → AGENTS.md   11 worktrees
       [x] telegram-console   CLAUDE.md
       [x] claude-skills      CLAUDE.md
     [!] ~/AGENTS.md applies to folders under your home folder
   Global settings are always included.
   ```

4. You untick what you don't want and confirm. The selected tools and folders are saved to `~/.config/agent-mapper/config.json`.
5. The CLI starts the server and opens `http://127.0.0.1:4545/?t=<token>`.

Skip the tool question with `npx agent-mapper --tools claude,codex`.

After that, tools are switched on and off in the web UI settings, and folders are added and removed in the sidebar. Turning a tool off hides its badges, columns, and hook sources everywhere; it doesn't delete anything. The **Add folder** dialog shows the same suggestions list above the button that opens the folder picker. **Rescan** re-runs discovery and lists repos that aren't added yet.

```sh
npx agent-mapper              # open the UI
npx agent-mapper why .        # terminal: what loads here, per tool
npx agent-mapper --json       # full map as JSON
```

### Discovery

A filesystem walk, not Spotlight. On Max's machine `mdfind` returned 4 of the 5 real files: it doesn't index symlinks (`pinchi-mobile/CLAUDE.md → AGENTS.md`) or hidden folders (worktrees under `~/.t3`).

A single walk looks for two kinds of hits:

| Hit | Matches | Why |
| --- | --- | --- |
| Tool folder | `.claude/`, `.codex/`, `.agents/`, `.opencode/`, `.cursor/` | Finds repos with skills, agents, hooks, or settings but no root instruction file. The walk records the folder and doesn't descend into it, so skill folders and their `AGENTS.md` files never show up as noise |
| Instruction or config file | `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENTS.override.md`, `opencode.json(c)` | Finds repos with only an instruction file, and subfolder instruction files |

The walk only matches patterns that at least one selected tool reads.

The walk:
- skips every hidden folder directly in `~` (`~/.gradle`, `~/.rvm`, `~/.t3`, …). The Global tool folders there are read directly, not discovered
- skips `node_modules`, `.git`, `Library`, `Pods`, `DerivedData`, `build`, `dist`, `.next`, `.expo`
- doesn't follow symlinked folders (avoids loops), but counts a symlinked tool folder as a hit
- maps each hit to its git repo root
- flags instruction files that sit outside any repo, such as `~/AGENTS.md`

Worktrees are not found by walking. For each repo found, agent-mapper reads `.git/worktrees/*/gitdir`, which points to every worktree wherever it lives. A worktree whose folder no longer exists is shown as **Stale** (git calls it "prunable").

Prototype results on Max's machine (second version kept in `prototypes/discovery-walk.mjs`):

| Version | Folders visited | Time | Worktrees found |
| --- | --- | --- | --- |
| Walk everything except a skip list | 25,324 (20,628 in `~/.gradle/caches`) | 600–800 ms | 11 |
| Skip hidden folders in `~`, read worktrees from git | 459 | ~30 ms | 13 (incl. 2 stale in `/private/tmp`) |

Both versions found the same 3 repos and `~/AGENTS.md`, and the worktree comparison showed `.agents/` missing in 7 of the 11 live `pinchi-mobile` worktrees.

Managed (admin) locations are read too when they exist, such as `/Library/Application Support/ClaudeCode/` and `/Library/Application Support/Cursor/hooks.json`. They show a **Managed** badge.

## UI

### Layout

| Area | Contents |
| --- | --- |
| Sidebar | **Global** (always first), added folders and their repos, worktrees, `+ Add folder` |
| Tabs | Instructions · Skills · Agents · Hooks · Memory |
| Main | The selected view for the selected scope |
| Detail panel | Path, symlink target, tool badges, issues, file preview, Open in editor, Reveal in Finder |

Press `⌘K` to jump to any file, skill, agent, hook, or repo.

**Add folder.** Clicking it opens the native macOS folder picker. The server runs `osascript -e 'choose folder'` and returns the path. On other platforms the UI falls back to a path input with autocomplete.

### Worktrees

Each worktree appears as an expandable row under its main repo in the sidebar. They are found by reading the `.git` file inside the worktree (`gitdir: <main>/.git/worktrees/<name>`), or with `git worktree list`. Worktrees live anywhere, such as `~/.t3/worktrees/pinchi-mobile/…`, so this doesn't depend on the scan roots.

```
▾ pinchi-mobile                         dev
    t3code-04fc7bd4                     investigate-collection-creation   ⚠ 2 missing
    t3code-36445b71                     detached
    …
```

Each worktree is compared with the main repo on instruction files, skills, agents, and hooks. Rows show:

| Marker | Meaning |
| --- | --- |
| ⚠ **Missing** | Exists in the main repo but not in the worktree. This is usually a gitignored or uncommitted file, such as `.claude/settings.local.json` hooks or a local skill |
| **Only here** | Exists in the worktree but not in the main repo |
| **Differs** | Same path, different content |
| No marker | Identical to the main repo |

Selecting a worktree opens the normal views, with missing items shown as ghost rows ("Missing: exists in main repo") so the gap is visible in context. The worktree list collapses by default and shows a count badge; only worktrees with differences get a marker.

### Visual language

The same badges appear in every view.

| Signal | Look |
| --- | --- |
| Tool | `C` Claude Code · `X` Codex · `O` OpenCode · `U` Cursor, one color per tool. A row shows every tool that reads it |
| Scope | **Global** and **Local** in two distinct colors. **Managed**, **Plugin**, and **Built-in** are neutral badges |
| Symlink | A link icon next to the name plus `→ target path` underneath. It is always visible, not only on hover |
| Symlink target is shared | "Linked from 3 places" chip. Click it to see all links to the same target |
| Broken symlink | Red link icon, "Target missing" |
| Not loaded | Row is dimmed with a reason, such as "Shadowed by CLAUDE.md" or "Project not trusted" |
| Usage | "Used 3× · 2 days ago" in muted text, or an **Unused** badge. Rows the logs can't speak for show nothing (see Usage evidence) |
| Cost | Token count with an **Always** or **On demand** label |
| Issue | Amber dot with a count. The detail panel lists the issues |

Symlinks are grouped by their target file. Two paths linked to the same file count as one item with several entry points, never as a duplicate.

### Instructions: what loads here

Select a folder in the tree. The main area shows one column per selected tool. Each column lists the files that will load, in order, following the rules in the Tool reference:

```
Claude Code                    Codex                        OpenCode                        Cursor
─────────────                  ─────────────                ─────────────                   ─────────────
Global ~/.claude/CLAUDE.md     Global ~/.codex/AGENTS.md    Global ~/.config/opencode/…     User Rules (in app)
Local  repo/CLAUDE.md 🔗       Local  repo/AGENTS.md        Local  repo/AGENTS.md           Local repo/AGENTS.md
Rule   .claude/rules/api.md    Local  repo/app/AGENTS.md    Config instructions: docs/*.md  Rule  expo.mdc  always
On demand repo/app/CLAUDE.md                                                                Rule  ui.mdc    *.tsx
Dimmed ~/AGENTS.md  shadowed by CLAUDE.md                                                   Dimmed argent.md  .md is ignored
```

- Each row shows the scope badge, path, symlink marker, size, and an estimated token count.
- Each column ends with a cost summary for that folder and tool:

  ```
  Always loaded    3,420 tokens   instructions 2,610 · skill and agent descriptions 810
  On demand       18,900 tokens   subfolder instructions, path rules, skill bodies
  ```

  Only the "always loaded" number is paid on every prompt. Skills and agents cost only their name and description up front, so a large unused skill costs little context and mostly adds confusion. The summary makes that difference visible instead of adding up every file.
- Files over 200 lines get an **Oversized** issue. That is the limit Anthropic recommends for `CLAUDE.md`, and agent-mapper applies it to every instruction file.
- "On demand" rows load only when the agent reads files in a matching folder or glob. They are shown in a lighter style.
- Files that exist but are skipped are shown dimmed with the reason. This is how useless instructions become visible.
- Cursor's User Rules and Team Rules are stored in the app or the dashboard, not in files. The column shows a note saying this instead of pretending there are none.

The tree marks every folder that contains an instruction file with small tool badges, so you can see which subfolders have their own rules.

### Skills

A single list sorted by name. Commands appear in the same list with a **Command** badge, because Claude Code and Cursor have merged commands into skills and Codex has deprecated prompts in their favor.

```
brainstorming        Global   C         Plugin: superpowers
design-system        Global   X O U     ~/.agents/skills   🔗 → ~/dotfiles/skills/design-system
tanstack-query       Local    C O U     agents-dashboard/.claude/skills
tanstack-query       Global   C O U     ⚠ Same name, different content
review               Local    O         Command · .opencode/commands
```

- Each row shows the name and description from frontmatter, the scope badge, the tools that read it, its folder, and the symlink marker.
- Filters: tool, scope, kind (skill / command), and "Issues only".
- The detail panel previews `SKILL.md` and lists its supporting files (`scripts/`, `references/`, `assets/`).

### Agents

Same layout as Skills. The format differs per tool: Markdown with frontmatter for Claude Code, OpenCode, and Cursor, and TOML for Codex. The row uses `name` and `description` from either format. OpenCode agents defined in `opencode.json` under `agent` appear with a **Config** badge.

### Hooks

Hooks are grouped into shared lanes, in the order they fire during a session:

```
Session start ─ Prompt submit ─ Before tool ─ Permission ─ After tool ─ Subagent ─ Compact ─ Stop ─ Session end
```

Each tool's event names are mapped onto these lanes:

| Lane | Claude Code | Codex | Cursor | OpenCode (plugin code) |
| --- | --- | --- | --- | --- |
| Session start | `SessionStart`, `Setup` | `SessionStart` | `sessionStart`, `workspaceOpen` | `session.created` |
| Prompt submit | `UserPromptSubmit`, `UserPromptExpansion` | `UserPromptSubmit` | `beforeSubmitPrompt` | `message.updated` |
| Before tool | `PreToolUse` | `PreToolUse` | `preToolUse`, `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile` | `tool.execute.before` |
| Permission | `PermissionRequest`, `PermissionDenied` | `PermissionRequest` | — | `permission.asked`, `permission.replied` |
| After tool | `PostToolUse`, `PostToolUseFailure`, `PostToolBatch` | `PostToolUse` | `postToolUse`, `postToolUseFailure`, `afterShellExecution`, `afterMCPExecution`, `afterFileEdit` | `tool.execute.after`, `file.edited` |
| Subagent | `SubagentStart`, `SubagentStop` | `SubagentStart`, `SubagentStop` | `subagentStart`, `subagentStop` | — |
| Compact | `PreCompact`, `PostCompact` | `PreCompact`, `PostCompact` | `preCompact` | `session.compacted` |
| Stop | `Stop`, `StopFailure` | `Stop`, `Interrupt` | `stop`, `afterAgentResponse` | `session.idle` |
| Session end | `SessionEnd` | `SessionEnd` | `sessionEnd` | `session.deleted` |
| Other | everything else, such as `Notification`, `FileChanged`, `WorktreeCreate` | `notify` (`agent-turn-complete`) | `afterAgentThought`, Tab events | everything else |

The "Other" lane is collapsed by default. Each card also shows the tool's original event name, so nothing is lost in the mapping.

A card shows:
- the matcher (for example, `Bash`, `Edit|Write`, `startup|clear|compact`)
- the handler: the command shortened to one line with a copy button, or the URL, MCP tool, or prompt for other hook types
- the source badge: Managed, Global, Local, Local (not committed), Plugin, Skill, or Agent
- the tool badges. Hooks in `.claude/settings*.json` get both `C` and `U`, because Cursor runs them too
- flags such as async, timeout, `failClosed`, or "needs trust" (Codex)

Selecting a folder shows only the hooks that apply there. **Open script** opens the script file when the command points to one.

Plugin hooks are read only from active plugin versions. The Claude Code cache keeps old versions (Max's machine has three copies of superpowers); reading all of them would show false duplicates.

### Memory

Memory files are written by the agents themselves, not by you, so they go stale without anyone noticing. The Memory tab lists them per repo and globally, with size, line count, and last modified date. Files not modified in 30 days get a muted "Not updated in N days" note.

| Tool | Locations |
| --- | --- |
| Claude Code | `~/.claude/projects/<encoded-path>/memory/MEMORY.md` and the files next to it. Loads the first 200 lines or 25 KB |
| Codex | `~/.codex/memories/` |
| Other | `MEMORY.md` inside tool folders, such as `pinchi-mobile/.agents/MEMORY.md`. The tool that writes it is shown when known, otherwise "Unknown writer" |

Claude Code's folder name encodes the repo path (`/Users/max/Developer/app` → `-Users-max-Developer-app`), so memory is matched back to its repo and worktree.

### Usage evidence

Session logs show which skills, agents, and hooks actually run. agent-mapper reads them and attaches usage to rows.

| Tool | Log location | What it records |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/<encoded-path>/*.jsonl` | Skill tool calls (`"name":"Skill","input":{"skill":…}`), subagent calls (`subagent_type`), hook runs (`hookEvent`, `hookName`) |
| Codex | `~/.codex/sessions/` | To be mapped |
| OpenCode, Cursor | Not checked yet | — |

Each row shows "Used N× · last <date>" or **Unused**. An **Unused** filter lists cleanup candidates.

**Unused** means "no use in the logs that exist", not "never used". Two limits keep it honest:
- Claude Code deletes logs after 30 days by default (`cleanupPeriodDays`). The header shows the coverage, for example "Usage from 15 sessions, Sep 1 – Sep 24".
- A skill counts only for the tools whose logs agent-mapper can read. A skill used only in Cursor shows no usage, not **Unused**.

Instruction files don't have usage, because they load on every session.

Logs are read locally and never leave the machine. Only counts and dates are kept; message content is not stored or shown.

On Max's machine the 15 retained Claude Code sessions show 3 of about 60 skills used (`code-review` ×2, `writing-plans`, `argent-device-interact`), `SessionStart` hooks 26×, and one agent type (`general-purpose` ×14).

## Tool reference

These are the loading rules agent-mapper implements. Each tool's rules live in its `ToolDefinition` and are covered by fixture tests.

### Claude Code (2.1.280)

| Item | Locations and rules |
| --- | --- |
| Instructions | Managed `CLAUDE.md` → `~/.claude/CLAUDE.md` → `CLAUDE.md` / `.claude/CLAUDE.md` / `CLAUDE.local.md` in every folder from `/` down to the working folder. Folders below it load on demand. `@path` imports, max 4 hops. Files over 4 MiB are skipped |
| AGENTS.md | Read only when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists in the working folder or above (default `claude-md-or-agents-md`). Other modes: `claude-md-and-agents-md`, `claude-md`, `managed-only`, set in user settings under `pluginConfigs["agents-md@builtin"].options.instructionFiles` |
| Rules | `~/.claude/rules/` and `.claude/rules/**/*.md`. No `paths` means always loaded; `paths` globs mean on demand |
| Skills | Managed, `~/.claude/skills/`, `.claude/skills/` from the working folder up to the repo root, nested `.claude/skills/` on demand, plugins. Name clash: managed > personal > project |
| Commands | `~/.claude/commands/`, `.claude/commands/` (equivalent to skills), `.claude/workflows/*.js` |
| Agents | `~/.claude/agents/`, `.claude/agents/`, plugin `agents/` |
| Hooks | Managed, `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, plugin `hooks/hooks.json`, skill and agent frontmatter. All merge. Identical handlers across settings files run once; plugin and skill copies run separately. Types: `command`, `http`, `mcp_tool`, `prompt`, `agent` |
| Plugins | Enabled in `enabledPlugins` in any settings file; files in `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. The active version comes from `installed_plugins.json` (schema not documented) |

Sources: [memory](https://code.claude.com/docs/en/memory), [skills](https://code.claude.com/docs/en/skills), [sub-agents](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks), [settings](https://code.claude.com/docs/en/settings), [plugins](https://code.claude.com/docs/en/plugins-reference)

### Codex (0.156.1)

| Item | Locations and rules |
| --- | --- |
| Instructions | `~/.codex/AGENTS.override.md` or `~/.codex/AGENTS.md`, then one file per folder from the project root down to the working folder: `AGENTS.override.md`, else `AGENTS.md`, else `project_doc_fallback_filenames`. Combined size capped by `project_doc_max_bytes` (32 KiB default) |
| Config | `~/.codex/config.toml`, `.codex/config.toml` per folder from root to working folder, `/etc/codex/config.toml`. Project `.codex/` layers (config, hooks, rules) are skipped unless the project is trusted (`projects."<path>".trust_level`) |
| Skills | `.agents/skills/` in the working folder and the repo root, `~/.agents/skills/`, `/etc/codex/skills`, built-in. Duplicates are not merged |
| Commands | `~/.codex/prompts/*.md`, deprecated in favor of skills |
| Agents | `~/.codex/agents/*.toml`, `.codex/agents/*.toml` (`name`, `description`, `developer_instructions`) |
| Hooks | `~/.codex/hooks.json` or `[hooks]` in `~/.codex/config.toml`, the same in `.codex/`, plugin `hooks/hooks.json`, managed `requirements.toml`. All merge. Non-managed hooks must be reviewed and trusted before they run. `notify` is separate and fires only on `agent-turn-complete` |
| Plugins | `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/`, enabled with `[plugins."<plugin>@<marketplace>"]` |

Sources: [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [config](https://learn.chatgpt.com/docs/config-file/config-basic), [skills](https://learn.chatgpt.com/docs/build-skills), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [hooks](https://learn.chatgpt.com/docs/hooks), [plugins](https://learn.chatgpt.com/docs/plugins)

### OpenCode

| Item | Locations and rules |
| --- | --- |
| Instructions | Walks up from the working folder: `AGENTS.md`, else `CLAUDE.md` (first match wins). Global `~/.config/opencode/AGENTS.md`, else `~/.claude/CLAUDE.md`. Plus every file, glob, or URL in `instructions` in the config. `@file` references are not followed. `OPENCODE_DISABLE_CLAUDE_CODE*` env flags turn the Claude fallbacks off |
| Config | `~/.config/opencode/opencode.json(c)`, project `opencode.json(c)` from the working folder up to the git root, `.opencode/`, managed `/Library/Application Support/opencode/`. Merged by key |
| Skills | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` from the working folder up to the git worktree root; `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`. `name` must match the folder name and `^[a-z0-9]+(-[a-z0-9]+)*$`, and must be unique |
| Commands | `~/.config/opencode/commands/`, `.opencode/commands/`, `command` in config |
| Agents | `~/.config/opencode/agents/`, `.opencode/agents/`, `agent` in config |
| Hooks | No hook config. Plugins subscribe to events in code: `~/.config/opencode/plugins/`, `.opencode/plugins/`, npm packages in `plugin` in config (cached in `~/.cache/opencode/node_modules/`) |

Folder names are plural. Singular names (`agent/`, `plugin/`) still work and are read too.

Sources: [rules](https://opencode.ai/docs/rules/), [config](https://opencode.ai/docs/config/), [skills](https://opencode.ai/docs/skills/), [agents](https://opencode.ai/docs/agents/), [commands](https://opencode.ai/docs/commands/), [plugins](https://opencode.ai/docs/plugins/)

### Cursor (3.17.21)

| Item | Locations and rules |
| --- | --- |
| Instructions | `AGENTS.md` at the root and in any subfolder (nested files combine, the more specific one wins). `.cursor/rules/**/*.mdc` only; plain `.md` files there are ignored. Rule type from frontmatter: `alwaysApply: true` always, `globs` on matching files, `description` only when the agent decides, none only when @-mentioned. The CLI also reads root `CLAUDE.md`. User and Team rules are not stored in files |
| Skills | `.agents/skills/`, `.cursor/skills/`, `.claude/skills/`, `.codex/skills/`; `~/.agents/skills/`, `~/.cursor/skills/`, legacy `~/.claude/skills/` and `~/.codex/skills/`. Built-in skills are managed by Cursor (on disk in `~/.cursor/skills-cursor/`, not documented) |
| Commands | Merged into skills. Old `.cursor/commands/` folders still exist in plugins |
| Agents | `.cursor/agents/`, `.claude/agents/`, `.codex/agents/` and the same under `~`. Project beats user; `.cursor/` beats `.claude/` and `.codex/` |
| Hooks | `.cursor/hooks.json`, `~/.cursor/hooks.json`, managed `/Library/Application Support/Cursor/hooks.json`, Team hooks (dashboard). Also loads Claude Code hooks from `.claude/settings.local.json`, `.claude/settings.json`, `~/.claude/settings.json` (on by default) |
| Plugins | `.cursor-plugin/plugin.json` or root `plugin.json`; local plugins in `~/.cursor/plugins/local/<name>`. Where marketplace plugins install is not documented |

Sources: [rules](https://cursor.com/docs/context/rules), [skills](https://cursor.com/docs/context/skills), [subagents](https://cursor.com/docs/context/subagents), [hooks](https://cursor.com/docs/agent/hooks), [third-party hooks](https://cursor.com/docs/reference/third-party-hooks), [plugins](https://cursor.com/docs/reference/plugins), [CLI](https://cursor.com/docs/cli/using)

## Issue detection

| Issue | Rule | Example on Max's machine |
| --- | --- | --- |
| Duplicated instructions | Split every loaded file into paragraphs, normalize whitespace, and hash each one. A paragraph that appears twice in one tool's load stack is a duplicate. Both locations are shown | |
| Drifted copies | Two files share at least 70% of their paragraphs but are not identical | `~/AGENTS.md` and `~/.claude/CLAUDE.md` |
| Ignored file | A file that exists but that no selected tool loads | `pinchi-mobile/.cursor/rules/argent.md` has `alwaysApply: true`, but Cursor ignores `.md` files in `rules/` |
| Shadowed file | A file skipped because another one wins | `~/AGENTS.md` is skipped by Claude Code in repos that have a `CLAUDE.md`, but loaded in repos without one |
| Not trusted | Codex skips project `.codex/` config, hooks, and rules in untrusted projects | |
| Too large | Codex load stack over `project_doc_max_bytes` (truncated); Claude Code file over 4 MiB (skipped) | |
| Inherited from home | An instruction file in `~` or another folder above your repos applies to folders below it | `~/AGENTS.md` |
| Broken references | A broken symlink, an `@import` to a missing file, or an `instructions` entry that matches nothing | |
| Stale reference | An instruction file mentions something that no longer exists in its repo: a path in backticks or a link (`src/legacy/api.ts`), a `package.json` script (`npm run e2e`), or a make target. Paths are checked relative to the file and to the repo root. Plain words that only look like paths are ignored; only backticked text and links count | A rule for a folder deleted months ago |
| Oversized | Instruction file over 200 lines, or skill description over 1024 characters (the OpenCode limit) | |
| Unused | Skill, agent, or hook with no use in the available session logs | 57 of about 60 skills |
| Skill seen twice | The same skill name reaches one tool from two locations | A skill in both `.claude/skills/` and `.agents/skills/` appears twice in OpenCode and Cursor |
| Shadowed skill or agent | Same name in different scopes with different content | |
| Invalid skill name | `name` doesn't match the folder name or the naming pattern (OpenCode, Cursor) | |
| Duplicate hook | The same handler on the same event from two sources that don't deduplicate | A plugin hook copied into `settings.json` |
| Empty or stub file | Almost no content, or only template content | |

Issues appear as amber dots on rows and as an **Issues** filter in each view.

## Architecture

```
packages/
  core/   tool definitions, scanner, resolvers, issue rules (pure TS, no I/O framework)
  cli/    argument parsing, first-run prompt, HTTP server, file watcher
  web/    Vite + React UI, built into cli at publish
```

```ts
type ToolId = "claude" | "codex" | "opencode" | "cursor"
type Scope = "managed" | "global" | "local" | "local-uncommitted" | "plugin" | "built-in"
type Kind = "instruction" | "rule" | "skill" | "command" | "agent" | "hook" | "config" | "memory"

interface Entry {
  path: string
  realPath: string              // resolved symlink target; equals path if not a link
  isSymlink: boolean
  kind: Kind
  scope: Scope
  readBy: ToolId[]              // every tool that reads this location
  meta?: { name?: string; description?: string; plugin?: string }
  tokens: number                // estimated
  load: "always" | "on-demand"  // for skills and agents: description is always, body is on demand
  usage?: Usage                 // absent when no readable logs cover this entry's tools
}

interface Usage {
  count: number
  lastUsed?: Date
  coverage: { sessions: number; from: Date; to: Date }
}

interface ToolDefinition {
  id: ToolId
  locations: LocationSpec[]     // glob + kind + scope; shared globs are declared by each tool that reads them
  resolveInstructions(folder: string, entries: Entry[]): InstructionLayer[]
  readHooks(entries: Entry[]): Hook[]
}

interface InstructionLayer {
  entry: Entry
  loaded: "always" | "on-demand" | "agent-decides" | "skipped"
  reason?: string               // "shadowed by CLAUDE.md", ".md ignored in .cursor/rules", "project not trusted"
}
```

`readBy` is computed by matching each found file against every selected tool's `locations`. This is what makes cross-tool reading visible.

## Stack

| Part | Choice |
| --- | --- |
| Runtime | Node ≥ 22 (published); Bun for development and workspaces |
| CLI | `node:util` `parseArgs`, `node:readline/promises` for the first-run prompt |
| Filesystem | `fs.glob`, `fs.lstat` / `fs.realpath` for symlinks, recursive `fs.watch` |
| Server | `node:http`: `GET /api/map`, `POST /api/folders`, `POST /api/open`, `GET /api/events` (server-sent events for live refresh) |
| Open actions | `open` (macOS) for Reveal in Finder; editor command from config, default `code` |
| UI | React, Tailwind v4, shadcn/ui, cmdk, TanStack Query |
| Parsers | `yaml` (frontmatter), a TOML parser (Codex config and agents), a JSONC parser (OpenCode config) |
| Tests | Vitest with temporary folders |

Every dependency and its version needs to be reviewed and approved before it is installed. The TOML and JSONC parsers are still to be chosen.

Security:
- Bind to `127.0.0.1` only.
- Require a random token in the URL.
- Reject requests whose `Host` header doesn't match.
- `POST /api/open` only accepts paths already in the map.

## Build order

1. `core`: location specs for all four tools, scanner with symlink resolution, `readBy` matching, fixture tests
2. Claude Code instruction resolver and `agent-mapper why .`
3. Codex, OpenCode, and Cursor resolvers
4. Skills, commands, agents, hooks, and memory readers
5. Token estimates and the always / on-demand split
6. Claude Code session log reader and usage attachment
7. Issue rules, including stale references
8. Server, first-run prompt, config file
9. Web UI: sidebar, Instructions view, detail panel, Open/Reveal actions
10. Skills, Agents, Hooks, and Memory views, then `⌘K`
11. Two weeks of daily use, then decide what comes next

## Later

Ideas from [Audit your agent files](https://addyosmani.com/blog/audit-your-agent-files/) that are deferred until the MVP has been used for a while.

**Content smells.** Flag lines that cost tokens without adding knowledge the agent can't get elsewhere:
- **Lint leakage:** style and formatting rules ("use 2 spaces", "sort imports") in a repo that already has Prettier, ESLint, Biome, or EditorConfig config. A study the article cites found it in 62% of repos.
- **README duplication:** paragraphs that repeat `README.md`, using the same paragraph hashing as duplicate detection.
- **Code tour:** long file or folder listings that restate the repo tree.
- **Generic advice:** "write clean code", "follow best practices", matched against a short built-in phrase list.

**Growth history.** For each instruction file, read `git log --numstat`: lines added vs removed over time, and date of last change. A file that only ever grows fits the pattern of a rule added after every agent mistake and never removed. Show a small sparkline in the detail panel and flag "only grows".

## Open items

- `agent-mapper` is confirmed and was free on npm and GitHub on 2026-09-24 (`agentmap` is taken). Reserve it on npm and GitHub before writing any code.
- Gaps in the docs, to check against real behavior with fixture repos:
  - Codex: how the "project root" for the `AGENTS.md` walk is found (probably the git root).
  - OpenCode: where the upward `AGENTS.md` walk stops.
  - Cursor: nested `.cursor/rules/` in subfolders; where marketplace plugins install; whether the CLI runs hooks.
  - Claude Code: the `installed_plugins.json` schema.
  - Session logs: the Codex log format, and whether OpenCode and Cursor keep readable logs. Which tool writes `.agents/MEMORY.md`.
- Token estimate method: characters ÷ 4 is enough to compare files. Decide whether that is good enough or a tokenizer is worth a dependency.
- OpenCode hooks: decide how far to go reading plugin code for event names. The simplest version lists plugin files and matches `"tool.execute.before"`-style keys with a regex.
- Choose a license before the first public release. The repo already has a `LICENSE` file; confirm it is the one you want.
