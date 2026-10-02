import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "packages/cli");
const web = resolve(cli, "dist/web");
// Vite hashes asset names, so copying over a previous build would keep every stale chunk in the package.
rmSync(web, { recursive: true, force: true });
cpSync(resolve(root, "packages/web/dist"), web, { recursive: true });
// The bundled fonts are SIL OFL, which requires the licence to travel with them; Vite emits only the font files.
cpSync(resolve(root, "packages/web/src/fonts"), resolve(web, "licenses"), {
  recursive: true,
  filter: (source) => !source.endsWith(".woff2")
});
// npm packs README and LICENSE only from the package folder, not the workspace root.
for (const file of ["README.md", "LICENSE"]) {
  cpSync(resolve(root, file), resolve(cli, file));
}
