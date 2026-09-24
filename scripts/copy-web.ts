import { cpSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
cpSync(
  resolve(root, "packages/web/dist"),
  resolve(root, "packages/cli/dist/web"),
  { recursive: true }
);
