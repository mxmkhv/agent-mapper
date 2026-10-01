import type { IncomingMessage, ServerResponse } from "node:http";
import type { SkillTransferRequest, ToolId } from "@agent-mapper/core";
import type { SkillTransferService } from "./skill-transfer";
import { documentError } from "./source-document-errors";
import {
  handleJsonRoute,
  sourceRef,
  text,
  type Body
} from "./source-document-routes";

const routePrefix = "/api/skill-transfer/";
const toolIds = new Set<string>(["claude", "codex"] satisfies ToolId[]);

function transferRequest(body: Body): SkillTransferRequest {
  const source = body.source;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw documentError("invalid_request", "The request is missing `source`.");
  }
  const mode = text(body, "mode");
  if (mode !== "copy" && mode !== "promote") {
    throw documentError("invalid_request", "Mode must be copy or promote.");
  }
  const tools = body.tools;
  if (
    !Array.isArray(tools) ||
    !tools.every((tool) => typeof tool === "string" && toolIds.has(tool))
  ) {
    throw documentError(
      "invalid_request",
      "Tools must be a list of claude and codex."
    );
  }
  return {
    // Checked above: a non-null, non-array object.
    source: sourceRef(source as Body),
    mode,
    projectPath: mode === "copy" ? text(body, "projectPath") : undefined,
    // Each element was checked against the known tool IDs.
    tools: tools as ToolId[]
  };
}

export function isSkillTransferRoute(pathname: string): boolean {
  return pathname.startsWith(routePrefix);
}

/** `plan` previews a copy or move; `apply` performs it if the folder still matches the preview. */
export function handleSkillTransferRoute(
  service: SkillTransferService,
  input: { request: IncomingMessage; response: ServerResponse; url: URL }
): Promise<void> {
  const action = input.url.pathname.slice(routePrefix.length);
  return handleJsonRoute({ ...input, label: "skill transfer" }, (body) => {
    if (action === "plan") {
      return service.plan(transferRequest(body));
    }
    if (action === "apply") {
      return service.apply({
        ...transferRequest(body),
        fingerprint: text(body, "fingerprint")
      });
    }
    throw documentError("not_found", "Unknown skill transfer route.");
  });
}
