# agent-mapper

A local map of your Claude Code and Codex setup. See what configuration is expected to apply to each project and where it comes from.

Agent configuration gets scattered across home folders, repositories, plugins, and symlinks. agent-mapper brings it into one view so you can trace a surprising instruction, spot a broken link, or figure out what needs cleaning up.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mxmkhv/agent-mapper/dev/docs/screenshots/project-map-dark.png">
  <img src="https://raw.githubusercontent.com/mxmkhv/agent-mapper/dev/docs/screenshots/project-map-light.png" alt="Project map showing global and project instructions, skills, agents, hooks, and MCP configuration, with a selected instruction's source and preview">
</picture>

Screenshots use a sample setup.

## Setup

Requires Node 22 or newer.

```sh
npx agent-mapper
```

The CLI opens your browser and prints the local URL. Keep the terminal running while you use the app. Press `Ctrl+C` to stop it.

To show one tool only:

```sh
npx agent-mapper --tools claude
npx agent-mapper --tools codex
```

Built and tested on macOS. Opening files in an editor, revealing them in Finder, and moving items to the Trash use macOS features. Delete requires macOS 15 or newer.

## Usage

1. Choose **Global** to browse your shared configuration, or select a project in the sidebar. Use **Add folder** for a project that wasn't discovered.
2. Open **Map** to see what a fresh session in that folder is expected to load. Select an item to see its source and the reason for its state.
3. Check **Findings** for broken links, shadowed instructions, missing plugin files, repeated startup text, and other review suggestions.

**Inventory** lists the discovered items. **Reach** shows which global sources apply to each project. **Worktrees** compares project configuration across linked Git checkouts.

Press `⌘K` to search by name or source path. Use **Open** to open a source file in your editor, **Reveal** to find it in Finder, and **Rescan** to refresh the inventory.

## Features

- Trace instructions through parent folders, imports, and symlinks.
- Browse global, project, and plugin skills and agents.
- Inspect hook declarations and MCP configuration without running them.
- Follow a plugin to its installed versions and contributed items.
- View memory file sizes and approximate context sizes.
- Edit instructions, skills, and agents with a diff review and version history.
- Copy skills and agents between projects or tools. Move unwanted ones to the macOS Trash.
- Use light or dark mode.

Configuration comes from `~/.claude`, `~/.claude.json`, `~/.codex`, `~/.agents`, and project files. Custom roots set through `CLAUDE_CONFIG_DIR` and `CODEX_HOME` are respected.

## Editing

1. Select an instruction, skill, or agent and click **Edit**.
2. Make your changes, then click **Review changes** or press `⌘S`. Review the diff, validation messages, and other scanned contexts that use the file.
3. Click **Save changes** to write the reviewed text.

**History** keeps the version replaced by each save or restore. You can restore it later. Copying a skill or agent never overwrites an existing file; copying agents between tools converts their format and lists settings that cannot transfer.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mxmkhv/agent-mapper/dev/docs/screenshots/edit-review-dark.png">
  <img src="https://raw.githubusercontent.com/mxmkhv/agent-mapper/dev/docs/screenshots/edit-review-light.png" alt="Reviewing an instruction edit with a side-by-side diff and the three affected projects before saving">
</picture>

<details>
<summary>Editing safeguards and limits</summary>

- Only existing, user-owned files in global or project scope can be edited. Plugin files, managed configuration, unknown scopes, hard-linked files, unwritable files, and files with mixed line endings open read-only with an explanation. Symlinks into plugin or managed folders are also read-only.
- Files must be UTF-8 without NUL bytes and no larger than 1 MiB. Saves that would exceed that size are refused. Use **Open** to edit unsupported files elsewhere.
- Saving through a symlink changes its real file and every path linked to it. The link stays intact, and the review lists known aliases.
- If the file changed on disk after you opened it, the save is blocked and your draft stays available. An external write between the final check and replacement can still be overwritten.
- History stores the replaced bytes before each save or restore. It cannot capture versions overwritten by another editor. Snapshots are private to your user and are not pruned automatically.
- History lives in `~/Library/Application Support/agent-mapper/revisions/` on macOS. Elsewhere it uses an absolute `$XDG_DATA_HOME/agent-mapper/revisions`, or `~/.local/share/agent-mapper/revisions`.
- Saves preserve permission mode, but replace the file. Extended attributes, ACLs, Finder tags, and the original creation date are not preserved.
- Unsaved drafts survive switching views, tools, and projects within the tab. Reloading asks first. Copy your draft before restarting the server, which ends the session.
- Saves and restores hold a `lock` in the file's history folder while writing. If an interrupted save leaves a lock behind, confirm no other agent-mapper process is saving that file before removing the lock and trying again.
- Codex agents must be valid TOML with text `name`, `description`, and `developer_instructions` fields. Claude Code agent frontmatter is checked like skill frontmatter.
- Delete moves an entire skill folder to the Trash. For a symlink, it moves only the link and leaves its target intact. The dialog lists other paths that would stop working. Plugin and managed items cannot be deleted, and deletion is blocked if the item changed after review. Use Finder's **Put Back** to restore a deleted item.
- Restart a running Claude Code or Codex session if it hasn't picked up a saved file.

</details>

## Privacy and limits

Scans are read-only. Writes happen only through reviewed save, restore, copy, or delete actions, plus agent-mapper's own history and lock files. The server listens on `127.0.0.1` and requires a per-session token.

agent-mapper never executes hook commands or starts or contacts MCP servers. Hook commands, MCP credentials, arguments, and full URLs stay out of inventory responses. When you open an instruction, skill, agent, or saved version, its full text goes to the local browser for preview and editing.

The Worktrees view can run `gh pr list` to look up pull requests when the GitHub CLI is installed. This is the app's only optional network lookup.

The map describes expected configuration for a fresh local CLI session. It does not observe running sessions or confirm that an MCP server is connected, authenticated, or healthy. Context sizes are estimates based on text length, not billed tokens. Unsupported formats and unreadable files stay visible as coverage notes.

<details>
<summary>What local scans cannot confirm</summary>

- Hook trust, remote policy, plugin marketplace entry overrides, and live session state.
- MCP account connections, approvals, remote policy, and unsupported declaration fields.
- Managed or session agents, Codex project trust, and live agent use.
- Exact Claude memory folder matches when encoded folder names collide.
- Inherited global configuration in worktree comparisons, or which declaration changed within a changed settings file.

Counts describe discovered declarations, not runtime capabilities.

</details>

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](https://github.com/mxmkhv/agent-mapper/blob/dev/CONTRIBUTING.md) for development setup, checks, and the release process.

## License

[MIT](https://github.com/mxmkhv/agent-mapper/blob/main/LICENSE)
