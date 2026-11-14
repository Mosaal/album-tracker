import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import indexHtml from "../../index.html?raw";
import { useThemeMode } from "./useThemeMode";

const STORAGE_KEY = "album-tracker:theme";

// index.html runs this before the app loads, to theme the header it shows.
const themeScript =
  new DOMParser()
    .parseFromString(indexHtml, "text/html")
    .querySelector("head > script")?.textContent ?? "";

const realMatchMedia = window.matchMedia;

function setSystemTheme(system: "light" | "dark") {
  window.matchMedia = (query) => ({
    ...realMatchMedia(query),
    matches: system === "dark" && query === "(prefers-color-scheme: dark)",
  });
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
  delete document.documentElement.dataset.theme;
});

describe("useThemeMode", () => {
  it.each([
    { saved: null, system: "light", theme: "light" },
    { saved: null, system: "dark", theme: "dark" },
    { saved: "dark", system: "light", theme: "dark" },
    { saved: "light", system: "dark", theme: "light" },
  ] as const)(
    "picks $theme with saved choice $saved on a $system system, as index.html does",
    ({ saved, system, theme }) => {
      if (saved) localStorage.setItem(STORAGE_KEY, saved);
      setSystemTheme(system);

      new Function(themeScript)();
      const { result } = renderHook(() => useThemeMode());

      expect(document.documentElement.dataset.theme).toBe(theme);
      expect(result.current.isDark).toBe(theme === "dark");
    },
  );
});
