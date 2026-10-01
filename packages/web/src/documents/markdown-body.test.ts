import { expect, it } from "vitest";
import { markdownBody } from "./markdown-body";

it("drops only a leading frontmatter block", () => {
  expect(markdownBody("---\nname: a\n---\n# Body\n---\nrule")).toBe(
    "# Body\n---\nrule"
  );
  expect(markdownBody("# Title\n---\nnot: frontmatter\n---\n")).toBe(
    "# Title\n---\nnot: frontmatter\n---\n"
  );
  expect(markdownBody("---\nunterminated")).toBe("---\nunterminated");
});
