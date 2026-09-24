import { execFileSync } from "node:child_process";

if (!process.env.CI && process.env.AGENT_MAPPER_SKIP_HOOK_INSTALL !== "1") {
  execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
    stdio: "inherit"
  });
}
