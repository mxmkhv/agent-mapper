import { useEffect, useRef, useState } from "react";

/**
 * macOS hides scrollbars until you scroll, so a wide matrix gives no hint that more projects sit to the right.
 * Tracks whether any columns are still out of view.
 */
export function useHiddenColumns<Element extends HTMLElement>() {
  const ref = useRef<Element>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const update = () =>
      setHidden(
        element.scrollLeft + element.clientWidth < element.scrollWidth - 1
      );
    // Observing the table as well catches columns added when a project finishes scanning.
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) {
      observer.observe(element.firstElementChild);
    }
    element.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);
  return { ref, hidden };
}
