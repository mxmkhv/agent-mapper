import { basename, resolve } from "node:path";
import { errorMessage, patchPaths, readInput } from "./io";

const blockedStatus = 2;
const protectedPath =
  /(?:eslint\.config|oxlint\.config|\.oxlintrc|tools\/oxlint(?:\/|\b)|\.agent-hooks(?:\/|\b)|\.githooks(?:\/|\b)|\.claude\/settings\.json|\.codex\/hooks\.json)/;
const forbiddenManager = /^(?:npm|pnpm|npx|yarn)$/;

function shellWords(command: string): string[] {
  return (
    command.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|()]+|[;&|()\n]/g) ?? []
  );
}

function managerCommand(command: string): boolean {
  let commandPosition = true;
  for (const word of shellWords(command)) {
    if (/^[;&|()\n]$/.test(word)) {
      commandPosition = true;
      continue;
    }
    if (!commandPosition) {
      continue;
    }
    const executable = basename(word.replace(/^["']|["']$/g, ""));
    if (forbiddenManager.test(executable)) {
      return true;
    }
    if (
      /^[\w]+=/u.test(word) ||
      /^(?:command|env|exec|sudo|time)$/.test(executable) ||
      word.startsWith("-")
    ) {
      continue;
    }
    commandPosition = false;
  }
  return false;
}

function readOnlyCommand(command: string): boolean {
  if (/[;&|<>`\n]|\$\(/.test(command)) {
    return false;
  }
  return /^\s*(?:(?:cat|head|tail|less|grep|rg)\s|git\s+(?:diff|show|status|log|commit)\b)/.test(
    command
  );
}

function block(reason: string): never {
  process.stderr.write(`BLOCKED: ${reason}\n`);
  process.exit(blockedStatus);
}

try {
  const input = readInput();
  const command = input.tool_input?.command ?? "";
  if (input.tool_name === "Bash") {
    if (managerCommand(command)) {
      block("This project uses bun. Use bun run, bun add, or bunx.");
    }
    if (protectedPath.test(command) && !readOnlyCommand(command)) {
      block(
        "Quality gate configuration is protected. Fix the code; ask Max before changing the rules or hooks."
      );
    }
  } else {
    const paths = [input.tool_input?.file_path ?? "", ...patchPaths(command)];
    if (
      paths.some(
        (path) =>
          path && protectedPath.test(resolve(input.cwd ?? process.cwd(), path))
      )
    ) {
      block(
        "Quality gate configuration is protected. Fix the code; ask Max before changing the rules or hooks."
      );
    }
  }
} catch (error) {
  block(
    `Guard could not run: ${errorMessage(error)} Check the hook payload and installation.`
  );
}
