/** Shortcut hints follow the browser's platform, which may differ from the server's over a forwarded port. */
export function shortcutLabel(key: string): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? `⌘${key}` : `Ctrl+${key}`;
}
