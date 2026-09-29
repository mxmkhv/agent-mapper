import { useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
const storageKey = "agent-mapper:theme";
const darkQuery = "(prefers-color-scheme: dark)";

function storedChoice(): ThemeChoice {
  const value = window.localStorage.getItem(storageKey);
  return value === "light" || value === "dark" ? value : "auto";
}

/** Resolves Auto against the OS setting and writes the result to <html data-theme>. */
export function useTheme(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(storedChoice);
  useEffect(() => {
    const media = window.matchMedia(darkQuery);
    function apply() {
      const dark = choice === "dark" || (choice === "auto" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [choice]);
  function choose(next: ThemeChoice) {
    window.localStorage.setItem(storageKey, next);
    setChoice(next);
  }
  return [choice, choose];
}
