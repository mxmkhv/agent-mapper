import type { IncomingMessage, ServerResponse } from "node:http";
import type { SkillTransferService } from "./skill-transfer";
import {
  handleSkillTransferRoute,
  isSkillTransferRoute
} from "./skill-transfer-routes";
import type { SourceDeleteService } from "./source-delete";
import { documentError } from "./source-document-errors";
import {
  handleJsonRoute,
  sourceRef,
  text,
  type Body
} from "./source-document-routes";

const routePrefix = "/api/source-delete/";

function source(body: Body) {
  const value = body.source;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw documentError("invalid_request", "The request is missing `source`.");
  }
  // Checked above: a non-null, non-array object.
  return sourceRef(value as Body);
}

/** `plan` says what would go to the Trash; `apply` moves it if it still matches the plan. */
function handleSourceDeleteRoute(
  service: SourceDeleteService,
  input: { request: IncomingMessage; response: ServerResponse; url: URL }
): Promise<void> {
  const action = input.url.pathname.slice(routePrefix.length);
  return handleJsonRoute({ ...input, label: "delete" }, (body) => {
    if (action === "plan") {
      return service.plan(source(body));
    }
    if (action === "apply") {
      return service.apply({
        source: source(body),
        fingerprint: text(body, "fingerprint")
      });
    }
    throw documentError("not_found", "Unknown delete route.");
  });
}

/** Routes that copy, move or delete a skill or agent. False when the route belongs elsewhere. */
export async function handleItemRoute(
  services: { skills: SkillTransferService; deletes: SourceDeleteService },
  input: { request: IncomingMessage; response: ServerResponse; url: URL }
): Promise<boolean> {
  if (input.url.pathname.startsWith(routePrefix)) {
    await handleSourceDeleteRoute(services.deletes, input);
    return true;
  }
  if (isSkillTransferRoute(input.url.pathname)) {
    await handleSkillTransferRoute(services.skills, input);
    return true;
  }
  return false;
}
