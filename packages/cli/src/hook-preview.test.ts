import { expect, it } from "vitest";
import { hookPreview, redactText } from "./hook-preview";

it("shows commands with exec-form arguments", () => {
  expect(
    hookPreview({
      type: "command",
      command: 'bash "$CLAUDE_PROJECT_DIR"/scripts/lint.sh'
    })
  ).toBe('bash "$CLAUDE_PROJECT_DIR"/scripts/lint.sh');
  expect(
    hookPreview({
      type: "command",
      command: "node",
      args: ["hooks/check.js", "--mode", "two words"]
    })
  ).toBe('node hooks/check.js --mode "two words"');
});

it("masks secret env assignments, flags, headers, and credential-shaped words", () => {
  expect(redactText("GITHUB_TOKEN=abc DEBUG=1 ./notify.sh")).toBe(
    "GITHUB_TOKEN=••• DEBUG=1 ./notify.sh"
  );
  expect(redactText("notify --api-key abc --token=def --verbose")).toBe(
    "notify --api-key ••• --token=••• --verbose"
  );
  expect(
    redactText('curl -H "Authorization: Bearer abc" -H "X-Api-Key: def" x')
  ).toBe('curl -H "Authorization: Bearer •••" -H "X-Api-Key: •••" x');
  expect(redactText("post sk-live123 ghp_abc123")).toBe("post ••• •••");
  expect(redactText(`check ${"a".repeat(40)}`)).toBe("check •••");
});

it("strips URL credentials and query values", () => {
  expect(
    hookPreview({
      type: "http",
      url: "https://user:secret@hooks.example.com/run?key=abc&team=x"
    })
  ).toBe("https://hooks.example.com/run?key=•••&team=•••");
  expect(redactText("curl https://user:secret@example.com/a")).toBe(
    "curl https://example.com/a"
  );
});

it("names MCP tools and previews prompts", () => {
  expect(
    hookPreview({ type: "mcp_tool", server: "scanner", tool: "scan" })
  ).toBe("scanner → scan");
  expect(hookPreview({ type: "prompt", prompt: "Review $ARGUMENTS" })).toBe(
    "Review $ARGUMENTS"
  );
  expect(hookPreview({ type: "command" })).toBeUndefined();
});

it("caps long previews", () => {
  expect(
    hookPreview({ type: "command", command: `echo ${"word ".repeat(200)}` })
  ).toHaveLength(401);
});
