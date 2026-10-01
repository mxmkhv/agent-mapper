# Quality gates

## Toolchain

| Tool                     | Exact version | Responsibility                                                |
| ------------------------ | ------------- | ------------------------------------------------------------- |
| Bun                      | 1.4.0         | Workspaces, installation, scripts, hook runtime, CLI bundling |
| Node                     | 26.7.0 for CI | Vite/Vitest/Oxlint runtime and published CLI smoke test       |
| TypeScript               | 7.0.2         | Strict workspace typechecking                                 |
| Oxlint / @oxlint/plugins | 1.85.0        | Native lint rules and vendored anti-slop                      |
| Knip                     | 6.38.0        | Unused code and dependency checks across workspaces           |
| Prettier                 | 3.9.9         | Formatting                                                    |
| Vitest                   | 5.0.1         | Hook, Git gate, and future application tests                  |
| lint-staged              | 17.5.1        | Formatting and linting the staged snapshot                    |

No ESLint, compatibility bridge, second compiler, or Husky. Git uses its native `core.hooksPath`. JSON parsing runs in Bun; jq is unnecessary.

Registry review on 2026-09-24: TypeScript, Oxlint, @oxlint/plugins, Knip, Prettier, Vitest, and lint-staged each exceed 100,000 weekly downloads and have releases within six months. Oxlint, @oxlint/plugins, and Knip each list one npm publisher/maintainer; they were explicitly selected for this project. Other listed tools have multiple registry maintainers. Runtime and React type packages are maintained through DefinitelyTyped despite its single publishing account. No new auth, cryptography, or networking package was introduced.

UI bootstrap versions are React/React DOM 19.3.0, Vite 8.3.1, React plugin 6.1.1, and Tailwind/Vite plugin 4.3.3. These have multiple registry maintainers, recent releases, and more than 100,000 weekly downloads. Registry dependency pins are exact; internal workspace packages use `workspace:*`, and the lockfile records transitive resolutions.

## Rules carried over

Native Oxlint rules retain strict equality, braces, no nested ternaries, complexity 15, file length 250, function length 50 for TypeScript, maximum two parameters, unused-variable handling, magic-number checks, and named exports. Framework configuration files can default-export as required. Numeric literals in tests and constants follow the prior exceptions.

Web sources enable native React and accessibility correctness rules, including rules-of-hooks and exhaustive-deps. Import restrictions enforce the current core/CLI/web direction. This is a simpler boundary policy than the original feature-capture ESLint plugin, not a claim of identical coverage.

The original nine anti-slop rules are enabled at error severity. Source and license are vendored under `tools/oxlint/anti-slop`; `UPSTREAM.json` records commit provenance. Upstream source, including tests and optional rules, is preserved unchanged. Only the selected nine are enabled. Project formatting and linting exclude the vendor tree; integration tests verify that the installed plugin reports violations.

Deferred rules: custom ESLint comment bans, simple-import-sort's exact sorting, filename/folder conventions, AST selectors for hardcoded styles, and advanced feature-level boundaries. These remain review conventions where applicable. Do not add plugins or new rules without a concrete need and Max's approval.

## Layers

| Layer          | Trigger                             | Behavior                                                                                |
| -------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| Guard          | Matched tool calls before execution | Exit 2 on common forbidden package-manager commands, protected writes, or guard failure |
| Edit feedback  | Edit/Write/MultiEdit/apply_patch    | Lint changed source; JSON context on violations; exit 0                                 |
| Shell feedback | Bash completion                     | Lint all Git-changed and untracked source; no timestamp cutoff                          |
| Completion     | Stop/SubagentStop                   | Changed-source lint plus workspace typecheck, including deletion/config-only changes    |
| Commit         | Native pre-commit                   | lint-staged followed by workspace typecheck                                             |
| Push           | Native pre-push                     | Full validate                                                                           |
| CI             | PRs, main/dev pushes, merge groups  | Full validate on Linux and macOS                                                        |

Pre-commit checks types after formatter changes. lint-staged handles partially staged files. Full working-tree typechecking can still report unstaged errors; CI checks the committed tree.

The completion hook requests one continuation through `decision: block`, then allows the next stop to prevent loops. It is a recovery prompt, not proof that corrections passed. Rerun failed checks after fixing them. `AGENT_STOP_TYPECHECK=0` skips only the completion typecheck; Git and CI typechecks remain mandatory.

All changed source files are checked after shell calls because modification times can be old or a command can run longer than twenty seconds. The tradeoff is repeated linting on a dirty tree. There is no persisted hook cache yet. Subagents sharing a dirty worktree may see each other's failures.

## Protection and failure behavior

Protected paths include Oxlint/ESLint config names, vendored rules, shared hook scripts, Git hooks, and agent hook registration. The guard is conservative mistake prevention, not a security boundary. It inspects common shell syntax; computed paths, arbitrary interpreters, or alternative tools can evade text inspection. The matcher covers the registered editing and shell tools, not every possible tool. Reads such as `cat`, `grep`, and simple Git inspection are allowed.

Malformed inputs, unavailable dependencies, process failures, and repository lookup failures produce actionable feedback. Guard failures block. Post-tool and completion failures return valid JSON with exit 0. An outer harness timeout may terminate a script before it can report; treat that as a failed check, not a pass.

The wrappers require Bash and Bun. Node must meet the documented minimum for the Oxlint TypeScript configuration and plugins. Missing Bun is reported without requiring jq or Node. CLI distribution code targets Node and does not require Bun.

## Verification and activation

`bun run test:hooks` uses isolated Git repositories and real tools. It covers Claude-style edits, Codex patch payloads, package-manager guard cases, anti-slop diagnostics, type errors, deletion/config-only changes, missing dependencies, invalid JSON, and missing Bun. Git tests attempt a real local commit and push to a temporary bare remote.

Script tests do not prove that an agent session loaded the hook registrations. Confirm project and hook trust in Codex's `/hooks`, reload the harness, and exercise one rejected command, one rejected protected edit, and one post-edit diagnostic in each harness. These interactive checks must be reported separately from script test results.

CI files are checked in, but making their statuses required for merging is a repository-host setting. Require both `Validate (ubuntu-latest)` and `Validate (macos-latest)` on `dev` and `main` when enabling branch protection. The release workflow pushes a merge commit to `dev` with `GITHUB_TOKEN`, so `dev` protection needs a bypass for GitHub Actions.

Official references: [Oxlint configuration](https://oxc.rs/docs/guide/usage/linter/config), [anti-slop](https://github.com/dmmulroy/anti-slop), [Knip workspaces](https://knip.dev/features/monorepos-and-workspaces), [lint-staged](https://github.com/lint-staged/lint-staged), [Claude hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://learn.chatgpt.com/docs/hooks).
