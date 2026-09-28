import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./theme.css";
import "./legacy-worktree.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error(
    "The app root is missing. Restore #root in index.html and reload."
  );
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
