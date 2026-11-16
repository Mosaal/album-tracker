import { useCallback, useEffect, useState } from "react";

import { isRecord } from "../albumFiles";
import { FORMAT_OPTIONS } from "../albumFormats";
import { AlbumFormat, Settings } from "../types";

const STORAGE_KEY = "album-tracker:settings";

const isFormat = (value: unknown): value is AlbumFormat =>
  FORMAT_OPTIONS.some((option) => option.value === value);

/** The saved settings, with the default for any that are missing or unreadable. */
function readSettings(): Settings {
  let stored: unknown;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    stored = null;
  }
  const settings: Settings = {
    gridDensity:
      isRecord(stored) && stored.gridDensity === "compact"
        ? "compact"
        : "normal",
  };
  if (isRecord(stored) && isFormat(stored.defaultFormat)) {
    settings.defaultFormat = stored.defaultFormat;
  }
  return settings;
}

/** Settings saved on this device, like the theme. Open tabs stay in step. */
export function useSettings() {
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    // A null key means another tab cleared the storage.
    const reload = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setSettings(readSettings());
      }
    };
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);

  const updateSettings = useCallback((change: Partial<Settings>) => {
    // Read afresh, so a change saved by another tab isn't undone.
    const next = { ...readSettings(), ...change };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
  }, []);

  return { settings, updateSettings };
}
