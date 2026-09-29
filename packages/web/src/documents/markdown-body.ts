const frontmatter = /^---\n[\s\S]*?\n---[ \t]*(?:\n|$)/;

/** The rendered body; frontmatter stays visible in Source and its diagnostics are shown separately. */
export function markdownBody(content: string): string {
  return content.replace(frontmatter, "");
}
