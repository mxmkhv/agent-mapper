import { useState } from "react";
import { Button } from "../ui/button";

/** Copies unsaved text to the clipboard and reports the result beside the button, never replacing other status. */
export function CopyTextButton(props: { text: string; label: string }) {
  const [result, setResult] = useState<string>();
  async function copy() {
    try {
      await navigator.clipboard.writeText(props.text);
      setResult("Copied to the clipboard.");
    } catch (error) {
      setResult(
        `Could not copy (${error instanceof Error ? error.message : String(error)}). Select the text and copy it manually.`
      );
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button onClick={() => void copy()}>{props.label}</Button>
      <output aria-live="polite" className="text-label text-ink-muted">
        {result ?? ""}
      </output>
    </span>
  );
}
