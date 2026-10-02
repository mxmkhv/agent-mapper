# Editing

agent-mapper can edit instructions, skills, and agents, and copy or delete skills and agents. Every write is reviewed before it happens.

## Edit a file

1. Select an instruction, skill, or agent and click **Edit**.
2. Make your changes, then click **Review changes** or press `⌘S`. Review the diff, validation messages, and other scanned contexts that use the file.
3. Click **Save changes** to write the reviewed text.

**History** keeps the version replaced by each save or restore. You can restore it later. Copying a skill or agent never overwrites an existing file; copying agents between tools converts their format and lists settings that cannot transfer.

## Safeguards and limits

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
- Delete moves an entire skill folder to the Trash. For a symlink, it moves only the link and leaves its target intact. The dialog lists other paths that would stop working. Plugin and managed items cannot be deleted, nor can skill folders holding 1,000 or more items or more than 50 MiB, which are too large to check. Deletion is also blocked if the item changed after review. Use Finder's **Put Back** to restore a deleted item.
- Restart a running Claude Code or Codex session if it hasn't picked up a saved file.
