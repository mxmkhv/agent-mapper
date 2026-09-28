# Provider verification

Checked on 2026-09-28 with locally installed Claude Code 2.1.283 (`claude --version`) and Codex CLI 0.158.0 (`codex --version`). The resolver fixtures cover default instruction paths, ancestor application, `.claude/CLAUDE.md`, Codex same-folder overrides, empty Codex files, and Claude's project `AGENTS.md` fallback. The findings fixtures cover exact repeated startup paragraphs, short-fragment exclusion, broken links, and the 200-line review threshold.

The rules were compared with the [Claude Code memory documentation](https://code.claude.com/docs/en/memory) and [Codex AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Installed CLI version and help output were checked locally. These tests do not trace a live model session, and custom instruction-file settings, trust gates, and runtime flags remain outside the resolver.

Run `bun run test --run packages/core/src/inventory.test.ts packages/cli/src/service.test.ts packages/cli/src/findings.test.ts` to repeat the controlled checks. Run `node packages/cli/dist/index.js why <folder>` or `node packages/cli/dist/index.js --json <folder>` to inspect a local folder.
