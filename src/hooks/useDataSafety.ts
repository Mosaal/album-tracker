import { useCallback, useEffect, useState } from "react";

const LAST_EXPORT_KEY = "album-tracker:last-export";
const REMINDER_KEY = "album-tracker:export-reminder";
const HOME_SCREEN_TIP_KEY = "album-tracker:home-screen-tip";
const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = 30;

export type DataSafetyNoticeKind = "home-screen-tip" | "export-reminder";

function readTime(key: string) {
  const time = Date.parse(localStorage.getItem(key) ?? "");
  return Number.isNaN(time) ? undefined : time;
}

function saveTime(key: string) {
  const now = Date.now();
  localStorage.setItem(key, new Date(now).toISOString());
  return now;
}

// iOS browsers can clear a site's storage once it goes unvisited for a while,
// but not a Home Screen app's.
function isIosBrowserTab() {
  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPads ask for desktop sites, so they look like a Mac with a touchscreen.
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIos && !window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Helps keep the collection, which only lives in this browser. Asks for
 * storage the browser won't clear to free up space, and picks at most one
 * notice: a tip to add the app to the iOS Home Screen, or a reminder to export
 * once 30 days pass without an export.
 */
export function useDataSafety(hasAlbums: boolean) {
  const [now] = useState(() => Date.now());
  const [lastExportedAt, setLastExportedAt] = useState(() =>
    readTime(LAST_EXPORT_KEY),
  );
  // When the reminder's 30 days started, if not at the last export.
  const [remindedAt, setRemindedAt] = useState(() => readTime(REMINDER_KEY));
  const [showHomeScreenTip, setShowHomeScreenTip] = useState(
    () => isIosBrowserTab() && !localStorage.getItem(HOME_SCREEN_TIP_KEY),
  );

  useEffect(() => {
    if (!hasAlbums) {
      return;
    }
    // The 30 days start once there's something to lose.
    if (!readTime(LAST_EXPORT_KEY) && !readTime(REMINDER_KEY)) {
      saveTime(REMINDER_KEY);
    }
    // Browsers grant this by themselves, to installed apps say, or ask.
    if (navigator.storage?.persist) {
      navigator.storage
        .persisted()
        .then((persisted) => persisted || navigator.storage.persist())
        .catch(() => {});
    }
  }, [hasAlbums]);

  const remindFrom = Math.max(lastExportedAt ?? 0, remindedAt ?? 0);
  const isExportDue =
    hasAlbums && remindFrom > 0 && now - remindFrom >= REMINDER_DAYS * DAY_MS;
  let notice: DataSafetyNoticeKind | undefined;
  if (showHomeScreenTip) {
    notice = "home-screen-tip";
  } else if (isExportDue) {
    notice = "export-reminder";
  }

  const recordExport = useCallback(() => {
    setLastExportedAt(saveTime(LAST_EXPORT_KEY));
  }, []);

  /** Hides the Home Screen tip for good, or the export reminder for 30 days. */
  const dismissNotice = useCallback(() => {
    if (notice === "home-screen-tip") {
      localStorage.setItem(HOME_SCREEN_TIP_KEY, "dismissed");
      setShowHomeScreenTip(false);
    } else {
      setRemindedAt(saveTime(REMINDER_KEY));
    }
  }, [notice]);

  return {
    notice,
    daysSinceExport:
      lastExportedAt === undefined
        ? undefined
        : Math.floor((now - lastExportedAt) / DAY_MS),
    recordExport,
    dismissNotice,
  };
}
