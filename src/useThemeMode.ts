import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "album-tracker:theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeChoice = "light" | "dark";

function readStoredChoice(): ThemeChoice | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

/** Follows the OS theme until the user picks one, which then persists across sessions. */
export function useThemeMode() {
  const [choice, setChoice] = useState<ThemeChoice | null>(readStoredChoice);
  const [systemIsDark, setSystemIsDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemIsDark(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const setIsDark = useCallback((isDark: boolean) => {
    const next: ThemeChoice = isDark ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, next);
    setChoice(next);
  }, []);

  return { isDark: choice ? choice === "dark" : systemIsDark, setIsDark };
}
