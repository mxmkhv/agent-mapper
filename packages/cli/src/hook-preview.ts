import type { JsonMap } from "./plugin-reader-common";

const maxPreviewLength = 400;
const mask = "•••";
const secretName =
  /(token|secret|passw(or)?d|pass|api[-_]?key|access[-_]?key|private[-_]?key|auth|credential|cookie|session|bearer)/i;
// Flags whose next word is a credential even though the flag name does not say so: curl -u user:pass.
const credentialFlag = /^(-u|--user)$/;
// The same credential attached to its flag: curl -ualice:pw, --user=alice:pw. Without a colon it is only a user name.
const attachedCredential = /^(-u|--user=)(.*:.*)$/s;
// Authorization schemes stay visible; the word after them is the credential.
const authScheme = /^(bearer|basic|token|digest|bot)$/i;
// Known credential formats, JWTs, and long opaque strings. A path or dotted name only matches the length rule
// when it has no "/" or "." at all.
const secretValue =
  /^(?:(?:sk|pk|rk)-[\w-]{8,}|gh[pousr]_\w{16,}|github_pat_\w{16,}|glpat-[\w-]{10,}|xox[abpr]-[\w-]{8,}|AKIA[0-9A-Z]{12,}|eyJ[\w-]+\.[\w-]+(?:\.[\w-]+)?|[A-Za-z0-9_+=-]{32,})$/;
// Webhook URLs carry their secret in the path.
const webhookHost =
  /(^|\.)hooks\.slack\.com$|(^|\.)discord(app)?\.com$|\.webhook\.office\.com$/i;
const opaqueSegment = /^(?=.*\d)(?=.*[A-Za-z])[\w-]{20,}$/;
// mysql -p<password> attaches the value to the flag.
const attachedPasswordTools = /^(mysql|mysqldump|mysqladmin|mariadb)$/;
// A secret-named key glued to its value anywhere in a word: X-Api-Key:abc, --header=Token:abc, {"token":"abc"}.
const secretPair = new RegExp(
  String.raw`^(.*?[\w.-]*(?:${secretName.source})[\w.-]*["']?[:=])(.+)$`,
  "is"
);

/** Fragments carry tokens in OAuth redirects (#access_token=…); mask their values like a query's. */
function redactFragment(url: URL): void {
  const fragment = url.hash.slice(1);
  if (fragment.includes("=")) {
    url.hash = fragment.replace(/=[^&]*/g, `=${mask}`);
  } else if (opaqueSegment.test(fragment)) {
    url.hash = mask;
  }
}

function redactPath(url: URL): void {
  if (webhookHost.test(url.hostname)) {
    url.pathname = `/${mask}`;
    return;
  }
  url.pathname = url.pathname
    .split("/")
    .map((segment) => (opaqueSegment.test(segment) ? mask : segment))
    .join("/");
}

/** http(s) and ws(s) URLs lose credentials, query and fragment values, and secret-looking path segments. */
function redactWebUrl(value: string): string | undefined {
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
  redactPath(url);
  redactFragment(url);
  // Serialization percent-encodes the mask; restore it without decoding anything the user wrote.
  return url.toString().replaceAll(encodeURIComponent(mask), mask);
}

/** Any other scheme://user:pass@host (postgres, redis, amqp…) keeps its shape with the credentials masked. */
function redactConnectionString(value: string): string | undefined {
  const match = /^([a-z][a-z0-9+.-]*:\/\/)([^/@\s]*@)?([^?#]*)(.*)$/i.exec(
    value
  );
  if (!match) {
    return undefined;
  }
  const [, scheme = "", credentials, rest = "", query = ""] = match;
  return `${scheme}${credentials ? `${mask}@` : ""}${rest}${query.replace(/=[^&#]*/g, `=${mask}`)}`;
}

function redactUrl(value: string): string | undefined {
  return redactWebUrl(value) ?? redactConnectionString(value);
}

/** Splits on whitespace outside quotes, keeping separators so the text keeps its shape. */
function tokenize(text: string): string[] {
  return text.match(/\s+|(?:"[^"]*"?|'[^']*'?|[^\s"']+)+/g) ?? [];
}

interface Quoted {
  open: string;
  inner: string;
  close: string;
}

function unquote(word: string): Quoted {
  const quote = word[0];
  if (
    (quote === '"' || quote === "'") &&
    word.length > 1 &&
    word.endsWith(quote)
  ) {
    return { open: quote, inner: word.slice(1, -1), close: quote };
  }
  return { open: "", inner: word, close: "" };
}

function maskWord(word: string): string {
  const { open, close } = unquote(word);
  return `${open}${mask}${close}`;
}

function redactWord(word: string): string {
  const assignment = /^(-{0,2}[A-Za-z_][\w.-]*)=(.+)$/s.exec(word);
  if (assignment?.[1] && assignment[2] && secretName.test(assignment[1])) {
    return `${assignment[1]}=${maskWord(assignment[2])}`;
  }
  const { open, inner, close } = unquote(word);
  if (open) {
    // A quoted header or argument ("Authorization: Bearer x") is redacted as its own text.
    return `${open}${redactText(inner, false)}${close}`;
  }
  const trailing = /[:,;]$/.exec(inner)?.[0] ?? "";
  const bare = trailing ? inner.slice(0, -1) : inner;
  const url = redactUrl(bare);
  if (url) {
    return `${url}${trailing}`;
  }
  const pair = secretPair.exec(inner);
  if (pair?.[1] && pair[2]) {
    return `${pair[1]}${maskWord(pair[2])}`;
  }
  return secretValue.test(bare) ? `${mask}${trailing}` : word;
}

function redactWords(words: string[]): string[] {
  const attachedPasswords = words.some((word) =>
    attachedPasswordTools.test(word)
  );
  let maskNext = false;
  return words.map((word) => {
    if (/^\s+$/.test(word)) {
      return word;
    }
    const bare = unquote(word).inner.replace(/:$/, "");
    if (authScheme.test(bare)) {
      maskNext = true;
      return word;
    }
    if (maskNext) {
      maskNext = false;
      return maskWord(word);
    }
    if (
      credentialFlag.test(word) ||
      (secretName.test(bare) &&
        (/^-{1,2}[\w-]+$/.test(bare) || /:["']?$/.test(word)))
    ) {
      maskNext = true;
      return word;
    }
    if (attachedPasswords && /^-p\S+$/.test(word)) {
      return `-p${mask}`;
    }
    const attached = attachedCredential.exec(word);
    if (attached?.[1] && attached[2]) {
      return `${attached[1]}${maskWord(attached[2])}`;
    }
    return redactWord(word);
  });
}

/**
 * Masks secret values in free-form handler text while keeping its shape: secret-named env assignments,
 * `--flag=value`s and `Key:value` pairs anywhere in a word, the word after a secret-named flag, `-u`, a
 * secret-named `Header:`, or an auth scheme (Bearer, Basic, token…), a `user:password` attached to `-u` or
 * `--user=`, URL credentials, query and fragment values, secret-looking path segments, webhook paths, mysql's
 * attached `-p`, and credential-shaped words. Quotes group words; this is not a full shell parser, so it errs
 * toward masking.
 */
export function redactText(text: string, cap = true): string {
  const result = redactWords(tokenize(text)).join("").trim();
  return cap && result.length > maxPreviewLength
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
