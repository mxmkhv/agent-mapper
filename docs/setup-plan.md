# Bootstrap and quality gates

## Agreed scope

Bootstrap `core`, `cli`, and `web` workspaces. Use Bun, TypeScript 7, Oxlint with the original nine anti-slop rules, Knip, Prettier, and Vitest. Keep agent feedback hooks, Git gates, and CI. No ESLint or TypeScript 6 compatibility layer.

## Implementation

1. Pin reviewed dependencies and vendor anti-slop with license and upstream commit. Configure strict workspace typechecking, linting, formatting, unused-code analysis, tests, and builds.
2. Write executable hook tests covering protected writes, Bun-only commands, patch payloads, malformed input, missing tools, subdirectory paths, deletions, and stop continuation. Implement shared typed scripts with thin shell launchers; JSON parsing does not require jq.
3. Wire Claude Code and Codex events. Add native Git hooks, staged formatting/linting, and full validation before pushes. Test hook behavior in temporary repositories without committing project changes.
4. Add CI on PRs, main/dev pushes, and merge groups. Run full validation on Linux and macOS, including the Node CLI smoke test. Document tool trust and what cannot be verified without an interactive agent session.

## Verification

Run failing hook tests before implementation. Use real Oxlint and compiler failures in isolated fixtures. Verify Knip catches unused exports, formatting catches unformatted files, Git hooks reject type errors and failing tests, and the built CLI runs under Node. Inspect the bootstrap UI in light and dark mode. Run `bun run validate` after the final changes.

## Constraints

- Exact dependency pins and committed lockfile; no install of latest ranges.
- Do not modify the original MVP brief or discovery prototype.
- Treat shell guards as conservative mistake prevention, not a sandbox.
- Gate infrastructure failures report actionable errors.
- Keep unsupported ESLint rules documented rather than introducing more plugins.
