#!/usr/bin/env bash
set -uo pipefail
MODE=$1
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if ! command -v bun >/dev/null 2>&1; then
  if [ "$MODE" = guard ]; then
    echo 'BLOCKED: bun is missing. Install Bun 1.4.0 and run bun install.' >&2
    exit 2
  fi
  if [ "$MODE" = stop-gate ]; then
    printf '%s\n' '{"decision":"block","reason":"QUALITY GATE DID NOT RUN: bun is missing. Install Bun 1.4.0 and run bun install."}'
  else
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Lint did not run: bun is missing. Install Bun 1.4.0 and run bun install."}}'
  fi
  exit 0
fi
bun "$ROOT/$MODE.ts"
STATUS=$?
if [ "$MODE" = guard ]; then
  if [ "$STATUS" -ne 0 ]; then
    echo 'Guard rejected the call or failed to run. Inspect the error above; fix the hook before continuing.' >&2
    exit 2
  fi
elif [ "$STATUS" -ne 0 ]; then
  if [ "$MODE" = stop-gate ]; then
    printf '%s\n' '{"decision":"block","reason":"Quality gate crashed. Inspect stderr, repair .agent-hooks, and run bun run validate."}'
  else
    printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Lint hook crashed. Inspect stderr, repair .agent-hooks, and run bun run lint."}}'
  fi
fi
exit 0
