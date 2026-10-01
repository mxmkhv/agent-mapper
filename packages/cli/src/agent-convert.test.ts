import { parse } from "smol-toml";
import { expect, it } from "vitest";
import { convertAgent } from "./agent-convert";

const claudeAgent =
  '---\nname: reviewer\ndescription: "Reviews: code"\ntools: Read, Grep\nmodel: opus\n---\n\nRead the diff.\nSay "done" and use C:\\paths.\n';

it("rewrites a Claude Code agent as Codex TOML and names what it drops", () => {
  const result = convertAgent({
    content: claudeAgent,
    from: "claude",
    fallbackName: "file"
  });
  if ("problem" in result) {
    throw new Error(result.problem);
  }
  expect(parse(result.content)).toEqual({
    name: "reviewer",
    description: "Reviews: code",
    developer_instructions: 'Read the diff.\nSay "done" and use C:\\paths.\n'
  });
  // Instructions stay a readable multi-line string.
  expect(result.content).toContain('developer_instructions = """\nRead the');
  expect(result.dropped).toEqual(["tools", "model"]);
});

it("rewrites a Codex agent as Claude Code Markdown", () => {
  const result = convertAgent({
    content:
      'description = "Finds: things"\nmodel = "gpt-5"\ndeveloper_instructions = """\nLook around.\n"""\n',
    from: "codex",
    fallbackName: "explorer"
  });
  expect(result).toEqual({
    content:
      '---\nname: explorer\ndescription: "Finds: things"\n---\n\nLook around.\n',
    dropped: ["model"]
  });
});

it("refuses to convert an agent it cannot read", () => {
  expect(
    convertAgent({
      content: "No frontmatter",
      from: "claude",
      fallbackName: "a"
    })
  ).toHaveProperty("problem");
  expect(
    convertAgent({ content: "name = [", from: "codex", fallbackName: "a" })
  ).toHaveProperty("problem");
});
