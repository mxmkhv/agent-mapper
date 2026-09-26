import type { InventorySnapshot, WorktreeRecord } from "@agent-mapper/core";

export interface ProjectSuggestion {
  path: string;
  hits: string[];
  worktrees?: WorktreeRecord[];
}
export interface ProjectList {
  projects: ProjectSuggestion[];
  errors: string[];
  exclusions: string[];
  maxDepth: number;
}
interface ActionRequest {
  path: string;
  id: string;
  action: "open" | "reveal";
}
type ApiPayload =
  ProjectList | InventorySnapshot | { ok: true } | { error: string };

function sessionToken(): string {
  const token = window.location.hash.slice(1);
  if (!token) {
    throw new Error(
      "This session link is missing its token. Reopen the URL printed by agent-mapper."
    );
  }
  return token;
}

async function request(path: string, init?: RequestInit): Promise<ApiPayload> {
  const response = await fetch(path, {
    ...init,
    headers: { ...init?.headers, authorization: `Bearer ${sessionToken()}` }
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      throw new Error(payload.error);
    }
    throw new Error(
      `Request failed with status ${response.status}. Rescan or reopen agent-mapper.`
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "Local API returned an invalid response. Restart agent-mapper."
    );
  }
  // The authenticated local API owns this payload and each caller checks the fields it consumes.
  return payload as ApiPayload;
}

export async function getProjects(signal?: AbortSignal): Promise<ProjectList> {
  const value = await request("/api/projects", { signal });
  if (
    !value ||
    typeof value !== "object" ||
    !("projects" in value) ||
    !Array.isArray(value.projects)
  ) {
    throw new Error(
      "Project discovery returned an invalid response. Restart agent-mapper."
    );
  }
  // The local API owns this payload; validate its top-level shape before using the shared contract.
  return value as ProjectList;
}

export async function getInventory(
  path: string,
  signal?: AbortSignal
): Promise<InventorySnapshot> {
  const url = path
    ? `/api/inventory?path=${encodeURIComponent(path)}`
    : "/api/inventory?scope=global";
  const value = await request(url, { signal });
  if (
    !value ||
    typeof value !== "object" ||
    !("items" in value) ||
    !Array.isArray(value.items)
  ) {
    throw new Error(
      "Inventory returned an invalid response. Rescan or restart agent-mapper."
    );
  }
  // The local API owns this payload; validate its top-level shape before using the shared contract.
  return value as InventorySnapshot;
}

export async function sourceAction({
  path,
  id,
  action
}: ActionRequest): Promise<void> {
  await request("/api/source-action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, id, action })
  });
}
