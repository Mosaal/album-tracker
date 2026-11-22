import { useCallback, useState } from "react";

import { useMediaQuery } from "./useMediaQuery";

const STORAGE_KEY = "album-tracker:theme";

/** A light or dark theme, or whichever the system uses. */
export type ThemeMode = "light" | "dark" | "system";

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/**
 * The theme chosen on this device, and whether it's dark. It follows the
 * system's until light or dark is chosen, which persists across sessions.
 */
export function useThemeMode() {
  const [mode, setSavedMode] = useState(readStoredMode);
  const systemIsDark = useMediaQuery("(prefers-color-scheme: dark)");

  const setMode = useCallback((next: ThemeMode) => {
    // Nothing saved means following the system, as index.html reads it too.
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    setSavedMode(next);
  }, []);

  return {
    mode,
    isDark: mode === "system" ? systemIsDark : mode === "dark",
    setMode,
  };
}
