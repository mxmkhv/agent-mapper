# agent-mapper

[![npm version](https://img.shields.io/npm/v/agent-mapper)](https://www.npmjs.com/package/agent-mapper)
[![license](https://img.shields.io/npm/l/agent-mapper)](https://github.com/mxmkhv/agent-mapper/blob/main/LICENSE)

**See what Claude Code and Codex are set up to load for every project, and where each piece comes from.**

```sh
npx agent-mapper
```

macOS, Node 22 or newer. Runs locally: scans are read-only, and it never executes hooks or contacts MCP servers.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mxmkhv/agent-mapper/main/docs/screenshots/project-map-dark.png">
  <img src="https://raw.githubusercontent.com/mxmkhv/agent-mapper/main/docs/screenshots/project-map-light.png" alt="Project inventory with a startup summary in load order above global and project instructions, skills, agents, hooks, and MCP configuration, with a selected instruction's source and preview">
</picture>

Screenshots use a sample setup.

## Why

Agent configuration accumulates. Old rules remain, skills overlap, and it becomes harder to tell what applies to each project. Addy Osmani's [Audit your agent files](https://addyosmani.com/blog/audit-your-agent-files/) makes the case for a regular cleanup. agent-mapper is built for that audit.

It answers the questions that otherwise mean digging through home folders, repositories, plugins, and symlinks:

- Which instruction files apply in this project, and in what order?
- Where did this skill, agent, hook, or MCP server come from?
- Is one source overriding another?
- Which links, imports, or plugins are broken?
- How much startup context comes from the instruction files and skill metadata it can inspect?

## Quick start

```sh
npx agent-mapper
```

On macOS the browser opens on its own. The terminal also prints the local URL. Keep the terminal running while you use the app, and press `Ctrl+C` to stop it.

Choose a project in the sidebar, or use **Add folder** if it isn't listed. Inspect its startup summary, then open **Findings** to review potential problems.

To show one tool only:

```sh
npx agent-mapper --tools claude
npx agent-mapper --tools codex
```

Built and tested on macOS. Opening files in an editor, revealing them in Finder, and moving items to the Trash use macOS features. Delete requires macOS 15 or newer.

## What you can see

### What a fresh session loads

Select a project to see its inventory. The summary on top lists what a fresh session in that folder is expected to load, in load order, with approximate context sizes. **Skill index** breaks down which skills and commands make up their share.

The sizes cover startup instruction files and the metadata of skills and commands. They leave out the content of imported files, memory, and anything the tool adds at runtime, such as its system prompt and MCP tool definitions.

In **Global**, **Projects** compares every project: its startup size, what it adds, where it differs from your global setup, and its findings.

### Where configuration comes from

Trace an instruction through parent folders, imports, and symlinks to the file that loads. Follow a plugin to its installed versions and the items it contributes. Select any item to see its source, the reason for its state, and what it overrides or what overrides it.

Press `⌘K` to search by name or source path. **Open in editor** and **Reveal in Finder** take you to any source file.

### What needs review

**Findings** lists what is hard to notice when configuration is spread across your filesystem:

- broken links and unreadable sources
- imports that point to missing files
- configured plugins that are missing
- shadowed sources
- skills that share a name
- long instruction files and repeated paragraphs

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mxmkhv/agent-mapper/main/docs/screenshots/findings-dark.png">
  <img src="https://raw.githubusercontent.com/mxmkhv/agent-mapper/main/docs/screenshots/findings-light.png" alt="Findings for a project: a broken skill link, an instruction file importing a missing file, and two skills sharing a name, with the importing file's preview and import status beside them">
</picture>

In a project with linked Git checkouts, **Worktrees** compares their configuration. Opened from a linked checkout, the same view is called **Differences**.

### Clean up from the same place

Edit instructions, skills, and agents with a diff review that lists the other projects using the file. Each save keeps the replaced version in **History**, so you can restore it. Copy skills and agents between projects or tools, and move unwanted ones to the macOS Trash.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/mxmkhv/agent-mapper/main/docs/screenshots/edit-review-dark.png">
  <img src="https://raw.githubusercontent.com/mxmkhv/agent-mapper/main/docs/screenshots/edit-review-light.png" alt="Reviewing an instruction edit with a side-by-side diff and the three affected projects before saving">
</picture>

See [Editing](https://github.com/mxmkhv/agent-mapper/blob/main/docs/editing.md) for the steps, safeguards, and limits.

## Supported tools

|              | Claude Code | Codex |
| ------------ | :---------: | :---: |
| Instructions |      ✓      |   ✓   |
| Skills       |      ✓      |   ✓   |
| Commands     |      ✓      |   —   |
| Agents       |      ✓      |   ✓   |
| Hooks        |      ✓      |   ✓   |
| MCP servers  |      ✓      |   ✓   |
| Plugins      |      ✓      |   ✓   |
| Memory       |      ✓      |   ✓   |

Configuration comes from `~/.claude`, `~/.claude.json`, `~/.codex`, `~/.agents`, and project files. Custom roots set through `CLAUDE_CONFIG_DIR` and `CODEX_HOME` are respected.

## Privacy and limits

Scans are read-only. Writes happen only through reviewed save, restore, copy, or delete actions, plus agent-mapper's own history and lock files. The server listens on `127.0.0.1` and requires a per-session token. There is no account and no hosted service.

agent-mapper never executes hook commands or starts or contacts MCP servers. Hook previews show command or handler text with common secret patterns masked. MCP credentials, arguments, and full URLs stay out of inventory responses. When you open an instruction, skill, agent, or saved version, its full text goes to the local browser for preview and editing.

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

Issues and pull requests are welcome. Two kinds of report help most:

- **Configuration that resolves incorrectly.** If agent-mapper shows something as applying, shadowed, or missing and the tool behaves differently, open an issue with a minimal, sanitized example of the files involved.
- **Platform problems.** CI runs on Linux and macOS, but the full desktop workflows have only been manually tested on macOS.

See [CONTRIBUTING.md](https://github.com/mxmkhv/agent-mapper/blob/main/CONTRIBUTING.md) for development setup, checks, and the release process.

## License

[MIT](https://github.com/mxmkhv/agent-mapper/blob/main/LICENSE)
