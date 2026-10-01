import { useEffect, useState } from "react";
import type { GroupFocus } from "../workspace/use-workspace";

/** The DOM id of an Inventory group's section, which a focus request scrolls to. */
export const groupElementId = (key: string) => `inventory-group-${key}`;

/**
 * Scrolls to a group asked for from elsewhere (a plugin's contributions in the inspector). `onReveal` runs
 * during render first, so whatever folds the group away opens before the scroll measures it.
 */
export function useGroupFocus(
  focus: GroupFocus | undefined,
  onReveal: (key: string) => void
): void {
  const [handled, setHandled] = useState<number>();
  if (focus && focus.request !== handled) {
    setHandled(focus.request);
    onReveal(focus.key);
  }
  const request = focus?.request;
  const key = focus?.key;
  useEffect(() => {
    if (key) {
      document
        .getElementById(groupElementId(key))
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [key, request]);
}
