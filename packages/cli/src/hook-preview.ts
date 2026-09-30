import type { JsonMap } from "./plugin-reader-common";

const maxPreviewLength = 400;
const mask = "•••";
const secretName =
  /(token|secret|passw(or)?d|pass|api[-_]?key|access[-_]?key|private[-_]?key|auth|credential|cookie|session|bearer)/i;
// Known credential prefixes, JWTs, and long opaque strings. Paths and dotted names keep their separators, so they never match.
const secretValue =
  /^(sk-|ghp_|gho_|ghs_|ghu_|github_pat_|glpat-|xox[abpr]-|AKIA|eyJ)|^[A-Za-z0-9_+=-]{32,}$/;

function redactUrl(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
    return undefined;
  }
  url.username = "";
  url.password = "";
  // A Set snapshot: set() collapses repeated keys, which would disturb a live iterator.
  for (const key of new Set(url.searchParams.keys())) {
    url.searchParams.set(key, mask);
  }
  return decodeURI(url.toString());
}

function redactWord(word: string): string {
  const [, open = "", bare = word, close = ""] =
    /^(["']?)(.*?)(["':,;]?)$/s.exec(word) ?? [];
  const assignment = /^(-{0,2}[A-Za-z_][\w.-]*)=(.+)$/.exec(bare);
  if (assignment?.[1] && secretName.test(assignment[1])) {
    return `${open}${assignment[1]}=${mask}${close}`;
  }
  const url = redactUrl(bare);
  if (url) {
    return `${open}${url}${close}`;
  }
  return secretValue.test(bare) ? `${open}${mask}${close}` : word;
}

/**
 * Masks secret values in free-form handler text while keeping its shape: env assignments and flags with
 * secret-like names, the word after a secret-like flag or "Bearer", URL credentials and query values, and
 * credential-shaped strings. Whitespace tokenizing is not a shell parser, so it errs toward masking.
 */
export function redactText(text: string): string {
  const parts = text.split(/(\s+)/);
  let maskNext = false;
  const redacted = parts.map((part) => {
    if (/^\s*$/.test(part)) {
      return part;
    }
    const bare = part.replace(/^["']|["':]$/g, "");
    // "Authorization: Bearer <token>": the scheme stays visible and the mask moves to the token.
    if (/^(bearer|basic)$/i.test(bare)) {
      maskNext = true;
      return part;
    }
    if (maskNext) {
      maskNext = false;
      return part.replace(/^(["']?).*?(["',;]?)$/s, `$1${mask}$2`);
    }
    if (
      secretName.test(bare) &&
      (/^-{1,2}[\w-]+$/.test(bare) || /[:=]["']?$/.test(part))
    ) {
      maskNext = true;
      return part;
    }
    return redactWord(part);
  });
  const result = redacted.join("").trim();
  return result.length > maxPreviewLength
    ? `${result.slice(0, maxPreviewLength)}…`
    : result;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function commandLine(handler: JsonMap): string | undefined {
  const command = string(handler.command);
  if (!command) {
    return undefined;
  }
  const args = Array.isArray(handler.args)
    ? handler.args
        .filter((arg): arg is string => typeof arg === "string")
        .map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
    : [];
  return [command, ...args].join(" ");
}

/** What the handler runs, redacted for the browser. Undefined when the declaration names nothing to show. */
export function hookPreview(handler: JsonMap): string | undefined {
  switch (handler.type) {
    case "command": {
      const command = commandLine(handler);
      return command ? redactText(command) : undefined;
    }
    case "http": {
      const url = string(handler.url);
      return url ? (redactUrl(url) ?? redactText(url)) : undefined;
    }
    case "mcp_tool": {
      const server = string(handler.server);
      const tool = string(handler.tool);
      return server && tool ? `${server} → ${tool}` : undefined;
    }
    case "prompt":
    case "agent": {
      const prompt = string(handler.prompt);
      return prompt ? redactText(prompt) : undefined;
    }
    default:
      return undefined;
  }
}
