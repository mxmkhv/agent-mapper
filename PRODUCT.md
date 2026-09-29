# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers on macOS who run Claude Code, Codex, or both across several repositories and Git worktrees. Their setup has grown in layers: global instructions, skills, plugins, MCP servers, hooks, project agents, and symlinks that share one file between tools or folders.

Their job is a periodic audit, weekly or monthly rather than daily. They need to understand what configuration an agent receives in a given project, where each piece comes from, and what to clean up. A second job is ad hoc: an agent did something surprising, and they need to find the instruction or capability behind it.

## Product Purpose

agent-mapper is a read-only local inventory of agent configuration for Claude Code and Codex. It shows what exists, where it comes from, what is expected to apply in a selected folder, and what deserves review.

Success means a developer can explain their setup and make a useful review or cleanup decision. Concretely, they can:

- find the source of a surprising instruction or capability and open it from the map;
- see which global sources reach which projects, and in what state;
- trace a plugin to its contributions and each contribution back to its plugin;
- see hooks, MCP servers, symlinks, worktree differences, inaccessible sources, and unsupported formats without anything being hidden.

Product scope and acceptance criteria live in [docs/mvp-v2.md](docs/mvp-v2.md).

## Positioning

agent-mapper resolves configuration per tool and per folder, with a reason for every state. A file listing cannot do that. It keeps four claims separate: Found, Expected to apply, Observed in sessions, and Unknown. It never claims more than local evidence supports. It follows symlinks, plugin versions, and parent-folder instructions back to the physical file that actually loads.

## Operating Context

- Launched with `npx agent-mapper`. A local server binds to `127.0.0.1` with a session token and opens the browser UI.
- Reads configuration roots such as `~/.claude`, `~/.claude.json`, `~/.codex`, `~/.agents`, `CODEX_HOME`, project `.claude/`, `.codex/`, `.agents/`, `.mcp.json`, `CLAUDE.md`, `AGENTS.md`, and `*.local` files.
- Discovers projects under home, enumerates Git worktrees, and watches selected sources. Rescan is always available.
- The only actions are Open in editor, Reveal in Finder, navigation, filtering, and rescanning.

## Capabilities and Constraints

- **Read-only.** The app never edits agent configuration, never runs hooks or commands, never starts or probes MCP servers, and never contacts marketplaces.
- **Tools.** Claude Code and Codex. The UI shows one tool at a time. Links between symlinked files cross tools, and following one switches the tool.
- **Item kinds.** Instructions, skills, commands, agents, hooks, plugins, MCP servers, memory, rules, config.
- **Layers** (product terminology, used everywhere in the UI):
  - **Global**: the user's tool roots (`~/.claude` for Claude Code, `~/.codex` and `~/.agents` for Codex).
  - **Plugins**: selected plugin versions and what they contribute.
  - **Project**: files in the repository and instruction files in its parent folders.
  - **User**: personal `*.local` files, such as `CLAUDE.local.md` and `settings.local.json`.
  - **Managed**: organization policy, shown only when present.
- **State vocabulary.** Configured, disabled, not used here (shadowed), cached version, needs approval, unknown, problem. MCP servers are never labeled Connected, Healthy, or Authenticated from configuration alone.
- **Secrets.** Environment variable and header names are shown without values. Credentials are redacted from URLs, arguments, previews, and logs. File content previews stay out of the browser until redaction is verified.
- **Context estimates.** Characters ÷ 4, always labeled approximate. They are text-volume estimates, not billed tokens.
- **Unknown stays visible.** Unsupported formats and unreadable sources appear as entries or coverage notes, never as silently empty lists.
- **Findings levels.** Problem, resolution information, review suggestion, coverage gap. There is no automatic recommendation to delete something based on length, age, or missing usage.
- **Undecided:** usage evidence from session logs; how worktree comparison fits the new layout; whether permissions in `settings.local.json` are inventoried; managed-source coverage.

## Brand Commitments

- The name is **agent-mapper**, lowercase.
- Tool names are **Claude Code** and **Codex**.
- Voice is precise and calm, and it never overclaims. Messages say what failed and what to do next. "Something went wrong" is not an acceptable message.

## Evidence on Hand

- Real local scans of the maintainer's machine: four projects (agent-mapper, pinchi-mobile, claude-skills, telegram-console), 45 plugin records, 24 MCP declarations, and symlinked instruction and skill files.
- UI direction screenshots in [docs/design/screenshots/](docs/design/screenshots/), taken from a throwaway prototype built on that data.
- There are no users, testimonials, benchmarks, or adoption numbers. Do not fabricate them.

## Product Principles

1. **Answer "what affects this project, and where does it come from?" before listing files.**
2. **Never claim more than the evidence.** Every state carries its reason and source. Unknown is a valid answer.
3. **Normal is quiet.** Only differences, inactive items the user asked to see, and verified problems ask for attention.
4. **One tool at a time.** Links bridge the tools; side-by-side is not the default.
5. **Safe by construction.** The app is read-only, executes nothing, contacts nothing, and exposes no secrets.

## Accessibility & Inclusion

- Light and dark mode are both required. Every screen is checked in both, including empty, loading, error, and partial-coverage states.
- Color is never the only signal. Tools have letter glyphs as well as colors, and states have marker shapes and text labels.
- Search (`⌘K`) and list navigation work from the keyboard.
