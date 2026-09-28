import { join, relative, sep } from "node:path";

export function codexProjectConfigPaths(
  root: string,
  selected: string
): string[] {
  const paths = [join(root, ".codex", "config.toml")];
  const difference = relative(root, selected);
  if (difference === ".." || difference.startsWith(`..${sep}`)) {
    return paths;
  }
  let directory = root;
  for (const part of difference.split(sep).filter(Boolean)) {
    directory = join(directory, part);
    paths.push(join(directory, ".codex", "config.toml"));
  }
  return paths;
}
