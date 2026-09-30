# agent-mapper: MVP v2

Status: Draft, revised after the MVP audit
Platform: macOS first, CLI + local web UI
Supported tools: Claude Code and Codex
Previous brief: [MVP v1](./mvp.md), preserved for reference

## Goal

Give developers a bird's-eye view of their local agent configuration: what exists, where it comes from, what is expected to apply in a project, and what deserves review.

The first release covers instructions, skills, commands, agents, hooks, memory, plugins, and MCP server configuration for Claude Code and Codex. It helps answer:

- Where did this instruction or capability come from?
- Which configuration applies in this repo or worktree?
- What did a plugin add?
- Which hooks and MCP servers are configured here?
- Which files are duplicated, shadowed, broken, or worth reviewing?

The app is read-only with respect to agent configuration, with a few explicit exceptions. Files stay where they are. Actions are Open in editor, Reveal in Finder, navigation, filtering, and rescanning. The app may save its own preferences. The exceptions below always need a deliberate click:

- Edit instructions and `SKILL.md` files in the app, with a diff review, conflict checks, and private revision history. Plugin and managed files stay read-only.
- Remove a project from the sidebar. This is an app preference in `~/.config/agent-mapper/config.json` (under `$XDG_CONFIG_HOME` when that is set); the folder is untouched and can be restored.
- Remove a linked worktree with `git worktree remove`, after an inline confirmation. The app never passes `--force`, so Git refuses checkouts with uncommitted changes or untracked files. Ignored files such as `.env` and `node_modules` are deleted with the folder, and the confirmation says so. The branch is kept.

The Worktrees view also shows each branch's pull request state. It is read-only and needs no click, and it is the app's only network read: `gh pr list`, through the user's own `gh` login, once per scan. A missing or logged-out `gh`, or a repository without a GitHub remote, leaves a hint; other `gh` failures show as errors.

## Scope

| Required for MVP                                         | Later                                               |
| -------------------------------------------------------- | --------------------------------------------------- |
| Claude Code and Codex inventory                          | Other agent tools                                   |
| Expected instruction loading, with reasons and limits    | Live session inspection                             |
| Skills, commands, agents, and memory                     | Content quality or performance assessments          |
| Hooks, including entries with unknown execution behavior | Hook execution and latency measurement              |
| Plugin inventory and contributed items                   | Install, update, enable, disable, or remove plugins |
| MCP configuration inventory                              | Connect, authenticate, probe, or manage MCP servers |
| Symlink provenance and worktree differences              | Cross-tool sync or conversion                       |
| Exact duplicates, broken references, confirmed shadowing | Similar-content and stale-prose heuristics          |
| Approximate startup and on-demand context volume         | Billing estimates                                   |
| Local web UI launched from the CLI                       | Desktop wrapper                                     |

## What the map can claim

Keep these separate throughout the UI and API:

| Claim             | Evidence                                                                         |
| ----------------- | -------------------------------------------------------------------------------- |
| Found             | A file, config declaration, or installation record exists                        |
| Expected to apply | A supported resolver evaluated the selected tool, project, settings, and version |
| Unknown           | The relevant format, setting, version, or runtime input cannot be resolved       |

Location matching finds candidates. It does not prove that an item loads or runs. Every resolved state includes its reason and source. Unknown entries remain visible.

The default explanation models a fresh local CLI session launched in the selected folder with the detected configuration. The header shows the working directory, tool version, configuration roots, and assumptions. Flags, app-specific behavior, remote settings, and environment overrides not available to the mapper are listed as coverage gaps. Do not imply that an existing session has reloaded changed files.

## Install and discovery

```sh
npx agent-mapper
npx agent-mapper --tools claude,codex
```

1. Detect Claude Code and Codex using configuration directories and binaries on PATH. Let the user choose either or both.
2. Discover candidate projects under home and read known global sources directly.
3. Show suggested projects, worktrees, and inherited instruction files. Let the user select projects or add a path.
4. Save choices to `~/.config/agent-mapper/config.json` and open the local UI.

Use a filesystem walk. Match `.claude/`, `.codex/`, `.agents/`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENTS.override.md`, and `.mcp.json`, subject to the selected tools. Record tool folders as hits and inspect them with dedicated readers instead of discovering their contents as unrelated projects.

Default discovery skips hidden directories directly under home and common generated directories: `node_modules`, `.git`, `Library`, `Pods`, `DerivedData`, `build`, `dist`, `.next`, and `.expo`. Default maximum depth is six levels below each discovery root. Show exclusions and the depth limit in scan details. Explicitly added folders are scanned even when outside home or under a skipped parent.

Do not follow directory symlinks during broad discovery. Record symlinked tool folders, then resolve their supported contents with cycle detection. Allow explicit additions of symlinked project roots. Read supported custom configuration roots, including `CODEX_HOME`, and show the roots actually used.

Discovery is best-effort. Report unreadable paths and partial results, with progress and cancellation for large scans. The prototype's local timings establish feasibility, not a universal subsecond guarantee.

Map hits to Git roots where possible; support non-Git folders too. Enumerate worktrees through `git worktree list --porcelain`, including when the selected path is itself a linked worktree. Surface missing or prunable worktrees without repairing Git metadata.

Read supported managed configuration sources when accessible. Missing access is a coverage gap, not an empty configuration.

## UI

| Area         | Contents                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| Sidebar      | Global, selected projects, worktrees, Add folder                                         |
| Tabs         | Instructions, Skills, Agents, Hooks, Memory, Plugins, MCP                                |
| Header       | Selected folder, tool filters, last scan, coverage summary                               |
| Detail panel | Source path and location within file, provenance, state and reason, preview, Open/Reveal |

Global shows the global inventory. Selecting a project shows its applicable global and project items, plus skipped and unresolved candidates. Filters include tool, scope, state, and findings. Search covers all item kinds; `⌘K` opens it.

Add folder uses the native macOS folder picker, with a path input fallback. Rescan refreshes discovery; file watching refreshes already selected sources. Turning off a tool only hides its results.

### Shared signals

Use tool badges for Claude Code and Codex. Separate scope from origin: an item can have project scope and come from a plugin. Preserve native scope names in details when their meanings differ between tools.

Show symlink targets persistently, with a Linked from N places action. Group files by resolved target for browsing while retaining every entry path in resolution. Do not assume that shared file identity implies runtime deduplication.

Use neutral states for configured, disabled, shadowed, and unknown items. Use warnings for verified problems such as broken references. Suggestions and coverage gaps are separate from problems.

### Worktrees

Compare each worktree with the main checkout across project configuration, including instructions, skills, agents, hooks, plugin declarations, and MCP declarations. Compare project-local declarations separately from inherited global configuration.

Use neutral markers: Only in main checkout, Only here, and Different content. Missing main-checkout items may appear as ghost rows, clearly excluded from the worktree's actual inventory and context totals. Branch differences are not automatically errors. Show Git tracking status when known rather than assuming a missing file was ignored or uncommitted.

### Instructions

Show one column per selected tool, with expected startup order and separate conditional entries. Include source, scope, imports, symlinks, estimated size, state, and explanation. Skipped files remain visible with the winning source where known.

Selecting a subfolder recomputes the explanation for that working directory. Distinguish startup, conditional, agent-selected, skipped, and unknown loading. Display unresolved assumptions beside the explanation.

Context summaries show:

- Estimated startup context from sources the resolver can account for.
- Available on-demand content, not an estimate of what a session will consume.
- Unaccounted content where metadata or loading rules are unavailable.

Start with characters divided by four, rounded and labeled approximate. Separate skill discovery metadata from skill bodies. Respect supported invocation controls and listing budgets. These figures are text-volume estimates, not billed tokens; content loaded on demand may remain in later context.

### Skills and agents

Skills are sorted by name and show description, scope, origin, tool, and expected availability. Commands share the list with a Command badge. Preserve tool-specific names and plugin namespaces when comparing names.

Preview `SKILL.md` and list supporting files. Link plugin-provided entries back to the plugin. Name collisions are resolved per tool and context; equal names across different tools are not automatically a problem.

Agents use the same browsing pattern, with readers for supported Markdown/frontmatter and TOML formats. Agents or commands declared inside configuration files have their own row and source locator.

### Hooks

Hook visibility is required for MVP, even when execution, trust, or deduplication cannot be assessed.

Read supported settings, standalone hook files, plugin hook declarations, and skill/agent frontmatter. Include configured, disabled, conditional, and unknown hooks. A hook tied to a skill or agent is labeled with that condition rather than presented as a general session hook.

Group hooks into browsing lanes: Session start, Prompt submit, Before tool, Permission, After tool, Subagent, Compact, Stop, Session end, and Other. These are navigation groups, not a guarantee of execution order or semantic equivalence. Keep the original event name on every card. Preserve unfamiliar events in Other.

Each card shows:

- Original event and matcher.
- Handler type and a redacted command, URL, MCP reference, or prompt preview.
- Source file and exact declaration location.
- Scope, tool, and parent plugin, skill, or agent.
- Declared flags such as async, timeout, or failure behavior.
- Expected applicability and trust state where supported, otherwise Unknown with a reason.

Open script is available only when the script path can be resolved without executing the command. Never run hooks, commands, or dynamic skill content during inspection. Unknown behavior does not suppress a card or block the view.

Only a plugin version identified as selected for that context contributes expected hooks. Other cached versions remain inspectable under Plugins. If selection is unknown, label candidate contributions accordingly instead of choosing the newest folder.

### Plugins

List plugins by tool, with name, marketplace or source, recorded version, scope, configured enablement, installation path, and resolution status.

Keep installation evidence separate from enablement. Distinguish selected version, disabled installation, cached version, configured but files missing, and unknown selection. A cache directory alone does not prove that a plugin is installed or enabled for the selected project.

The detail panel lists discovered contributions: skills, commands, agents, hooks, and MCP declarations. Each contribution links to its normal inventory row; every contributed row links back to its plugin. Counts mean discovered declarations, not runtime capabilities.

Read manifests, installation records, and settings without executing plugin code or contacting marketplaces. Unsupported records remain visible with their source and a coverage note. Installation, updates, toggles, removal, and update-availability checks are deferred.

### MCP

List configured MCP servers per tool and selected scope. Show name, source, transport, redacted destination or executable, configured enablement, and parent plugin or agent where applicable.

Claude Code sources include user and project-local records in `~/.claude.json`, project `.mcp.json`, plugin declarations, and accessible managed sources. Codex sources include `mcp_servers` declarations in applicable TOML configuration and supported plugin declarations. Resolve precedence and approval only where the adapter has verified support. [Claude MCP reference](https://code.claude.com/docs/en/mcp), [Codex MCP reference](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

Use Configured, Disabled, Shadowed, Approval required, or Unknown as justified by local evidence. Never label a server Connected, Healthy, or Authenticated based on configuration alone. Do not start servers, probe endpoints, run credential helpers, enumerate live tools, or initiate authentication.

Show environment variable and header names without their secret values. Redact credentials from URLs, arguments, previews, and logs before sending data to the browser. If a free-form value cannot be safely displayed, hide it and offer Open in editor. Apply the same handling to hooks and plugin settings.

Cloud/account connectors and session-only declarations that are unavailable locally appear as coverage limitations. An empty local inventory does not prove the tool has no connections.

### Memory

List known memory files by tool and project with path, size, line count, and modification date. Show supported global and project memory sources, including Claude Code project memory and Codex's memory directory.

Memory may be agent-written or manually maintained. Age alone is not a finding. Unknown writer and Unmatched project are valid states; do not infer a unique project solely by reversing a lossy encoded directory name. Memory loading contributes to estimates only where its rules are supported.

## Findings

| Level                  | Examples                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Problem                | Broken symlink, missing explicit import, malformed supported config, configured plugin files missing             |
| Resolution information | Shadowed source, disabled declaration, trust requirement, inherited home instructions                            |
| Review suggestion      | Repeated substantive paragraphs in one expected load stack, long instruction file, multiple same-name candidates |
| Coverage gap           | Unsupported version or format, unreadable source, unknown plugin selection                                       |

Exact paragraph comparison normalizes whitespace and ignores trivial headings or tiny fragments. Show both sources and whether they can apply together. Hook duplicate findings require matching execution conditions and known deduplication rules; otherwise show similar declarations without claiming duplicate execution.

The 200-line instruction threshold is a review heuristic, not a universal tool limit. Actual size limits are tool-specific and must be distinguished from it. No automatic recommendation to delete an item based solely on length or age.

Similarity scoring, stale prose paths, missing package scripts in prose, generic-advice detection, and growth history are deferred until the deterministic findings are useful and trusted.

## Architecture

```text
packages/
  core/   source readers, normalized inventory, tool resolvers, findings
  cli/    arguments, discovery I/O, preferences, local server, watching
  web/    React UI built into the published CLI
```

Keep filesystem access behind reader interfaces so resolver logic can be tested with captured inputs. One tool adapter owns its supported locations, parsers, precedence, and capability coverage.

The data model separates physical sources, logical entries, contextual resolution, and observations:

```ts
type ToolId = "claude" | "codex";
type Kind =
  | "instruction"
  | "rule"
  | "skill"
  | "command"
  | "agent"
  | "hook"
  | "config"
  | "memory"
  | "plugin"
  | "mcp";

interface SourceFile {
  id: string;
  path: string;
  realPath?: string; // absent for a broken or inaccessible target
  isSymlink: boolean;
  readState: "readable" | "missing" | "unreadable";
}

interface Entry {
  id: string;
  kind: Kind;
  name?: string;
  sourceId: string;
  locator?: string; // config key, section, or frontmatter location
  candidateTools: ToolId[];
  origin: "direct" | "plugin" | "built-in";
  parentEntryId?: string;
}

interface ResolutionContext {
  id: string;
  tool: ToolId;
  version?: string;
  workingDirectory: string;
  configRoots: string[];
  assumptions: string[];
}

interface Resolution {
  entryId: string;
  contextId: string;
  scope: "managed" | "global" | "project" | "project-private" | "unknown";
  availability:
    "expected" | "disabled" | "shadowed" | "approval-required" | "unknown";
  loading:
    "startup" | "conditional" | "agent-selected" | "not-applicable" | "unknown";
  reason: string;
  evidence: string[];
  estimatedTokens?: { startup: number; onDemand: number };
}
```

These are shared contracts, not complete payload definitions. Kind-specific parsers produce typed details for hooks, plugins, and MCP declarations. Raw secrets never enter the public API payload. Multiple declarations in one file receive different IDs. Preserve entry paths and plugin ownership even when physical content is shared.

## Tool support and verification

V1's reference tables are research inputs, not proof of runtime behavior. Initial verification targets are the versions recorded there: Claude Code 2.1.280 and Codex 0.156.1. Record the versions actually tested and keep inventory available for other versions with an explicit resolution coverage note.

Each adapter records the official source, verification date, supported versions, and known gaps for each capability. Honor documented custom roots and keep private installation/log formats isolated behind version-aware readers.

| Tool        | References                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | [Memory and instructions](https://code.claude.com/docs/en/memory), [skills](https://code.claude.com/docs/en/skills), [agents](https://code.claude.com/docs/en/sub-agents), [hooks](https://code.claude.com/docs/en/hooks), [settings](https://code.claude.com/docs/en/settings), [plugins](https://code.claude.com/docs/en/plugins-reference), [MCP](https://code.claude.com/docs/en/mcp)                                                             |
| Codex       | [Instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [configuration](https://learn.chatgpt.com/docs/config-file/config-basic), [skills](https://learn.chatgpt.com/docs/build-skills), [agents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [hooks](https://learn.chatgpt.com/docs/hooks), [plugins](https://learn.chatgpt.com/docs/plugins), [MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) |

Test precedence, imports, namespacing, symlinks, worktrees, custom roots, trust, plugin version selection, and multiple entries per file using fixtures. Compare critical loading claims against the actual tools in controlled repositories with inert configuration. Unit fixtures alone do not establish tool compatibility.

Unknown hook events and plugin schemas must produce visible entries or source-level coverage gaps, never silently empty lists. Malformed files report their path and parse error while unaffected sources remain available.

## Tech stack

| Part                         | Choice                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| Published CLI                | Node; Bun bundles a Node-targeted distribution                          |
| Development and workspaces   | Bun 1.4.0; Node 26.7.0 toolchain                                        |
| Language                     | TypeScript 7.0.2, strict, noUncheckedIndexedAccess, noImplicitOverride  |
| UI and build                 | React 19, Vite 8, Tailwind 4                                            |
| Lint                         | Oxlint with native rules and the original nine vendored anti-slop rules |
| Formatting                   | Prettier                                                                |
| Unused code and dependencies | Knip across all workspaces                                              |
| Tests                        | Vitest, real-tool hook tests, Git gate integration tests                |
| Hooks                        | Shared TypeScript scripts with shell launchers; native Git hooks        |
| CI                           | Full validation on Linux and macOS                                      |
| Planned UI additions         | shadcn/ui, cmdk, TanStack Query when their features are built           |
| Parsing                      | Platform JSON; reviewed, pinned YAML and TOML dependencies              |

Registry dependencies are pinned exactly in manifests; internal workspace packages use `workspace:*`, and `bun.lock` records transitive resolutions. No ESLint or second TypeScript compiler. Tooling requires Node 22.22.1 or newer; the final published CLI minimum must also match the filesystem APIs selected during implementation.

## Quality gates

Establish gates during scaffolding, before feature work. Per-edit and shell hooks return Oxlint feedback. Stop/SubagentStop checks changed source with Oxlint plus workspace typechecking, requesting one continuation on failure. Git pre-commit runs staged formatting/linting and typechecking; pre-push and CI run formatting, Oxlint, typechecking, Knip, the full tests, builds, and the Node CLI smoke test. See [quality gate details](quality-gates.md) for rules, verification, and limitations.

## Local access

Bind only to `127.0.0.1`. Use a random session token, validate Host and Origin, and authenticate API and event-stream access. Open/Reveal accepts mapped source IDs, resolves them server-side, and invokes executables with argument arrays rather than interpolated shell commands.

Treat previews as untrusted text. Redact sensitive config before preview or logging. Do not execute scanned content or fetch remote configuration. Watch selected sources and resolved targets, not the entire home directory; explicit Rescan remains available.

## Build order

1. Bootstrap the workspace and quality gates described above.
2. Build source readers and contextual resolution contracts for both tools, including coverage reporting.
3. Deliver a complete instructions-and-skills flow: select a repo, inspect sources and findings, and Open/Reveal in the UI.
4. Add plugin inventory and contribution links, including selected versus cached versions.
5. Deliver Hooks and MCP views, preserving unknown and disabled declarations.
6. Add agents, memory, worktree comparisons, context estimates, and cross-view search.
7. Validate deterministic findings and critical resolver behavior against fixtures and real tools.
8. Use the app for real configuration audits.

Hooks, plugins, and MCP visibility are release requirements. Incomplete assessments do not postpone their inventories.

## Acceptance criteria

- A developer can find the source of a surprising instruction or capability and open it from the map.
- Both tools show global and project sources with reasons for expected, skipped, or unknown applicability.
- A plugin's discovered contributions can be inspected from the plugin and traced back from each item.
- Hooks remain visible without execution evidence, including unknown events and conditional hooks.
- MCP declarations show configuration and provenance without claiming connectivity or exposing credentials.
- Worktree differences, symlink entry paths, inaccessible sources, and unsupported formats are visible.
- Every implemented screen is inspected through screenshots in light and dark mode, including empty, loading, error, and partial-coverage states.

Success means users can explain their setup and make a useful review or cleanup decision. A weekly or monthly audit is enough; daily engagement is not a requirement.

## Open questions before implementation

- Validate plugin installation-record schemas, selection rules, and contribution formats for both target versions.
- Verify project-root boundaries, instruction fallbacks, custom roots, and hook trust behavior using controlled tool runs.
- Establish which memory records can be attributed to a project without guessing.
- Identify account-managed configuration that cannot be inventoried locally and document that coverage clearly.
- Review parser dependencies, exact runtime minimum, package-name availability, and the existing license before release.

Further editing should keep explicit diffs and reversible changes. Snapshot/restore, disable-to-test workflows, and updates remain outside this release.
