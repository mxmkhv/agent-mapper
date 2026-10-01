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
  const cases: [string, string][] = [
    [
      "GITHUB_TOKEN=abc DEBUG=1 ./notify.sh",
      "GITHUB_TOKEN=••• DEBUG=1 ./notify.sh"
    ],
    [
      "notify --api-key abc --token=def --verbose",
      "notify --api-key ••• --token=••• --verbose"
    ],
    [
      'curl -H "Authorization: Bearer abc" -H "X-Api-Key: def" x',
      'curl -H "Authorization: Bearer •••" -H "X-Api-Key: •••" x'
    ],
    [
      'curl -H "Authorization: token abc123" x',
      'curl -H "Authorization: token •••" x'
    ],
    [
      "curl -u admin:hunter2 https://api.example.com",
      "curl -u ••• https://api.example.com/"
    ],
    [
      "curl --user=admin:hunter2 https://api.example.com",
      "curl --user=••• https://api.example.com/"
    ],
    ["curl -uadmin:hunter2 x", "curl -u••• x"],
    ["curl -sSu admin:hunter2 x", "curl -sSu ••• x"],
    ["curl -sualice:hunter2 x", "curl -su••• x"],
    ["curl -U admin:hunter2 x", "curl -U ••• x"],
    ["curl --proxy-user=admin:hunter2 x", "curl --proxy-user=••• x"],
    ["curl --user=admin x", "curl --user=admin x"],
    ['curl --user="admin:two words" x', 'curl --user="•••" x'],
    ["mysql -uroot -phunter2 app", "mysql -uroot -p••• app"],
    ['MY_TOKEN="abc def" ./run.sh', 'MY_TOKEN="•••" ./run.sh'],
    ["run --token 'two words' --fast", "run --token '•••' --fast"],
    ["curl -H X-Api-Key:visible-secret x", "curl -H X-Api-Key:••• x"],
    ['curl -H "X-Api-Key:visible-secret" x', 'curl -H "X-Api-Key:•••" x'],
    [
      "curl --header=Authorization:visible-secret x",
      "curl --header=Authorization:••• x"
    ],
    [`echo '{"token":"visible-secret"}'`, `echo '{"token":•••'`],
    [`post sk-live${"x".repeat(12)} ghp_${"a1".repeat(10)}`, "post ••• •••"],
    [`check ${"a".repeat(40)}`, "check •••"]
  ];
  for (const [input, expected] of cases) {
    expect(redactText(input)).toBe(expected);
  }
});

it("keeps ordinary paths and names that only look like key prefixes", () => {
  expect(redactText("sk-tools/run.sh --mode fast")).toBe(
    "sk-tools/run.sh --mode fast"
  );
  expect(redactText("bash .claude/hooks/session-start.sh")).toBe(
    "bash .claude/hooks/session-start.sh"
  );
});

it("never lets a known secret through, whatever its shape", () => {
  const secret = "visible-secret";
  const shapes = [
    `X-Api-Key:${secret}`,
    `curl -H "X-Api-Key:${secret}"`,
    `curl --header=Authorization:${secret}`,
    `open https://x.example/cb#access_token=${secret}`,
    `open https://x.example/cb?token=${secret}`,
    `psql postgres://user:${secret}@db/app`,
    `API_KEY=${secret} run`,
    `run --password ${secret}`,
    `curl --user=alice:${secret}`,
    `curl -ualice:${secret}`,
    `curl -su alice:${secret}`,
    `curl -sualice:${secret}`,
    `curl --proxy-user alice:${secret}`,
    `curl -H "Authorization: Bearer ${secret}"`
  ];
  for (const shape of shapes) {
    expect(redactText(shape)).not.toContain(secret);
  }
});

it("strips credentials from URLs, connection strings, and webhook paths", () => {
  expect(
    hookPreview({
      type: "http",
      url: "https://user:secret@hooks.example.com/run?key=abc&team=x"
    })
  ).toBe("https://hooks.example.com/run?key=•••&team=•••");
  expect(
    hookPreview({
      type: "http",
      url: "https://hooks.slack.com/services/T0AAA/B0BBB/abcdefghijklmnop"
    })
  ).toBe("https://hooks.slack.com/•••");
  const cases: [string, string][] = [
    ["curl https://user:secret@example.com/a", "curl https://example.com/a"],
    [
      "notify https://example.com/hook/a1b2c3d4e5f6g7h8i9j0k1",
      "notify https://example.com/hook/•••"
    ],
    [
      "psql postgres://admin:hunter2@db.local/app",
      "psql postgres://•••@db.local/app"
    ],
    [
      "cli redis://:hunter2@host:6379?auth=x",
      "cli redis://•••@host:6379?auth=•••"
    ],
    [
      "open https://app.example.com/cb#access_token=visible-secret&state=x",
      "open https://app.example.com/cb#access_token=•••&state=•••"
    ],
    [
      "open https://app.example.com/cb#a1b2c3d4e5f6g7h8i9j0k1",
      "open https://app.example.com/cb#•••"
    ],
    [
      "open https://docs.example.com/guide#setup",
      "open https://docs.example.com/guide#setup"
    ]
  ];
  for (const [input, expected] of cases) {
    expect(redactText(input)).toBe(expected);
  }
});

it("previews URLs with malformed percent escapes instead of failing the scan", () => {
  expect(redactText("curl https://example.com/%zz/100%")).toBe(
    "curl https://example.com/%zz/100%"
  );
  expect(hookPreview({ type: "http", url: "https://example.com/%FF" })).toBe(
    "https://example.com/%FF"
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

it("keeps the start of long previews", () => {
  const preview = hookPreview({
    type: "command",
    command: `echo start ${"word ".repeat(200)}`
  });
  expect(preview).toHaveLength(401);
  expect(preview?.startsWith("echo start word")).toBe(true);
  expect(preview?.endsWith("…")).toBe(true);
});
