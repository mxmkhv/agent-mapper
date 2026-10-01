import { cpSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "packages/cli");
cpSync(resolve(root, "packages/web/dist"), resolve(cli, "dist/web"), {
  recursive: true
});
// npm packs README and LICENSE only from the package folder, not the workspace root.
for (const file of ["README.md", "LICENSE"]) {
  cpSync(resolve(root, file), resolve(cli, file));
}
