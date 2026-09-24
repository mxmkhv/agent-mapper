// Reference prototype for discovery (docs/mvp.md → Discovery). Not production code:
// untyped, hardcoded to ~, swallows unreadable folders, no tests. Port to packages/core/src/discovery.
// Run: node prototypes/discovery-walk.mjs
import { opendir, readFile, readdir } from "node:fs/promises"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
const HOME = homedir()
const TOOL = new Set([".claude", ".codex", ".agents", ".opencode", ".cursor"])
const FILES = new Set(["CLAUDE.md", "CLAUDE.local.md", "AGENTS.md", "AGENTS.override.md", "opencode.json", "opencode.jsonc"])
const SKIP = new Set(["node_modules", ".git", "Library", "Pods", "DerivedData", "build", "dist", ".next", ".expo"])
const hits = []; let dirs = 0
async function walk(dir, depth) {
  dirs++
  const subdirs = []
  for await (const e of await opendir(dir).catch(() => [])) {
    const path = join(dir, e.name)
    if (TOOL.has(e.name) && (e.isDirectory() || e.isSymbolicLink())) { if (dir !== HOME) hits.push(path); continue }
    if (e.isDirectory()) {
      if (SKIP.has(e.name) || (dir === HOME && e.name.startsWith("."))) continue
      if (depth < 6) subdirs.push(path)
    } else if (FILES.has(e.name)) hits.push(path)
  }
  await Promise.all(subdirs.map((d) => walk(d, depth + 1)))
}
const t = performance.now()
await walk(HOME, 0)
const repos = new Set()
for (const h of hits) { let d = dirname(h); while (d !== HOME && d !== "/") { if ((await readdir(d)).includes(".git")) { repos.add(d); break } d = dirname(d) } }
for (const r of repos) {
  const names = await readdir(join(r, ".git/worktrees")).catch(() => [])
  const wts = await Promise.all(names.map(async (n) => dirname((await readFile(join(r, ".git/worktrees", n, "gitdir"), "utf8")).trim())))
  console.log(r.replace(HOME, "~"), wts.length ? `(${wts.length} worktrees, e.g. ${wts[0].replace(HOME, "~")})` : "")
}
console.log(`\n${dirs} folders, ${hits.length} hits, ${(performance.now() - t).toFixed(0)} ms`)
