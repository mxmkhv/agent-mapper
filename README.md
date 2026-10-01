<div align="center">

# agent-mapper

**See what your coding agents actually load.**

A local map of your Claude Code and Codex configuration: what exists, where it comes from,<br>
what is expected to apply in each project, and what deserves review.

[![CI](https://github.com/mxmkhv/agent-mapper/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/mxmkhv/agent-mapper/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)

</div>

```sh
npx agent-mapper
```

## Why

Agent setups grow in layers: global instructions, skills, plugins, MCP servers, hooks, project agents, and symlinks that share one file between tools. After a while it is hard to say what an agent receives in a given repository, or why it did something surprising.

agent-mapper scans your machine and answers two questions:

- **What affects this project, and where does it come from?** Every item is resolved per tool and per folder, with a reason for its state.
- **What should I clean up?** Broken links, shadowed instructions, missing plugin files, overlong instructions, and repeated text across startup sources.

It never claims more than local evidence supports. Unsupported formats and unreadable files stay visible as coverage notes instead of disappearing from the list.

## Quick start

Requires Node 22 or newer.

```sh
npx agent-mapper                 # open the UI for all tools
npx agent-mapper --tools codex   # only Codex
npx agent-mapper --tools claude  # only Claude Code
```

The CLI starts a server on `127.0.0.1`, protected by a per-session token, and opens the UI in your browser. Press <kbd>⌘</kbd> <kbd>K</kbd> to search every item by name or source path.

## What it covers

| Item         | What you see                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| Instructions | `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENTS.override.md`, imports, and parent-folder files that apply |
| Skills       | User, project, and plugin skills, with the metadata loaded at startup                                          |
| Agents       | Claude Code Markdown agents, Codex TOML agents, and plugin agents                                              |
| Hooks        | Event, matcher, handler type, and source, grouped by lifecycle area                                            |
| MCP servers  | Declarations from user, project, plugin, and managed config, without credentials                               |
| Plugins      | Installation, enablement, cached and selected versions, and what each plugin contributes                       |
| Memory       | Memory files with size, line count, and modified time                                                          |

Configuration is read from `~/.claude`, `~/.claude.json`, `~/.codex`, `~/.agents`, `CODEX_HOME`, and each project's `.claude/`, `.codex/`, `.agents/`, and `*.local` files.

## Views

**Global**

- **Reach**: how each global source reaches each project, and in what state.
- **Inventory**: everything found in your tool roots.
- **Findings**: problems and review suggestions, each linked to its source.

**Project**: pick a suggested project or enter any folder path, including folders outside your home.

- **Map**: what a fresh session in this folder is expected to load, with approximate context sizes for startup text, skill metadata, and on-demand content.
- **Inventory**: every item that applies here, grouped by layer: Global, Plugins, Project, User, Managed.
- **Findings**: issues specific to this folder.
- **Worktrees**: project configuration in each linked Git checkout compared with the main checkout.

Select any item to see its source, its expected state and why, and the symlinks and plugin it belongs to. **Open** opens the file in your editor; **Reveal** shows it in Finder.

## Editing

Instructions, skills, and agents can be edited in place. Nothing is written until you review the exact diff and click **Save changes**.

1. Select an instruction, `SKILL.md`, or agent, then click **Edit**.
2. Press <kbd>⌘</kbd> <kbd>S</kbd> or click **Review changes** to see the diff, frontmatter checks, and every scanned context that uses the file.
3. Click **Save changes** to write exactly the reviewed text.

Every save keeps the previous version. **History** restores any snapshot, and a restore can be undone the same way.

You can also **Copy** a skill or agent into another project, for either tool. Agents are converted between Claude Code Markdown and Codex TOML; tool-specific settings are listed and left out. **Delete** moves a skill or agent to the macOS Trash, where Put Back restores it.

<details>
<summary><b>Editing rules and safeguards</b></summary>

- **Editable:** existing, user-owned files discovered in global or project scope, UTF-8 with one line-ending style. These open read-only with the reason: plugin files, managed configuration, anything a symlink resolves into a plugin or managed folder, unknown scope, hard-linked files, files owned by another user, files you cannot write or whose folder you cannot write, and files that mix line endings.
- **Not opened:** files over 1 MiB, files that are not UTF-8, and files containing NUL bytes show an error instead; use **Open** to edit them elsewhere. A save is also refused if the file would exceed 1 MiB once its line endings are applied.
- **Symlinks:** saving writes the real file, so every path that links to it changes; the link itself stays a link. The review lists known aliases.
- **Conflicts:** if the file changed on disk since you opened it, nothing is written. Your draft stays; compare it with the current file, then drop it or continue editing and review again. This is optimistic detection: an editor writing in the moment between the final check and the rename can still be overwritten.
- **History:** before each save or restore, the replaced bytes are stored in `~/Library/Application Support/agent-mapper/revisions/` (elsewhere: an absolute `$XDG_DATA_HOME/agent-mapper/revisions`, otherwise `~/.local/share/agent-mapper/revisions`), private to your user and never pruned automatically. A version that was saved and then overwritten by another editor is not captured.
- **Metadata:** a save replaces the file. Text, symlinks, and permission mode are kept; macOS extended attributes, ACLs, Finder tags, and the original creation date are not.
- **Drafts:** unsaved edits survive switching views, tools, and projects (see **Drafts** in the header), but live only in the open tab. Reloading asks first; restarting the server ends the session, so copy a draft before reopening the new URL.
- **Locks:** each save or restore holds `lock` in the file's history folder only while it writes, and the lock records the pid that created it. If a save reports that lock as busy and no other agent-mapper process is saving that file, an interrupted save left it behind: delete the lock and save again.
- **Agents:** a Codex agent must parse as TOML with text `name`, `description` and `developer_instructions` before it saves; a Claude Code agent's frontmatter is checked like a skill's. Copying never overwrites an existing file.
- **Delete:** requires macOS 15 or later. A skill folder goes whole; a symlinked one loses only the link, and the folder it points to stays. The dialog names other paths that will stop working. Plugin and managed items cannot be deleted. If the item changed since the dialog opened, nothing is deleted.
- Running Claude Code or Codex sessions may need a restart to pick up a saved file.

</details>

## Privacy and safety

- **Scans are read-only.** agent-mapper writes only when you save, restore, copy, or delete through the review steps above, plus its own history and lock files.
- **Nothing runs.** Hooks and commands are never executed, and MCP servers are never started or contacted.
- **Secrets stay in source files.** Hook commands, MCP credentials, arguments, and full URLs are not sent to the UI. Free-form file content is left out of inventory responses; the exceptions are the instruction, skill, or agent you select and the saved versions you open, which are sent in full to the local page so you can preview and edit them.
- **One optional network call.** The Worktrees view runs `gh pr list` to show pull requests for linked branches when the GitHub CLI is installed.

## Known limits

The inventory describes what a fresh local CLI session is expected to load. It does not observe running sessions, and states such as Configured never mean Connected or Healthy.

<details>
<summary><b>Outside local coverage</b></summary>

- **Hooks:** unsupported declaration shapes, hook trust decisions, remote policy, plugin marketplace entry overrides, and live session state.
- **MCP:** account and session connections, approval state, remote policy, and unsupported declaration fields.
- **Agents:** managed and session agents, unsupported declarations, Codex project trust, and live use.
- **Memory:** Claude project folder matches are candidates, because encoded folder names can collide.
- **Worktrees:** inherited global configuration is left out of the comparison, and a changed settings file does not identify which declaration inside it changed.
- **Counts** describe discovered declarations, not runtime capabilities. Context sizes are character-based estimates, not billed tokens.

</details>

agent-mapper is built and tested on macOS. Open, Reveal, and Delete use macOS features.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, quality gates, and the release process.

## License

[MIT](LICENSE)
