import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { readJson } from "../../json";
import { downloadedText, mockDownloads } from "../../test/downloads";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

const LAST_EXPORT_KEY = "album-tracker:last-export";
const DAY_MS = 24 * 60 * 60 * 1000;
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

const ALBUMS: Album[] = [
  { id: "1", title: "Kind of Blue", artist: "Miles Davis", status: "owned" },
  { id: "2", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
];

const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY_MS).toISOString();

function renderApp(albums: Album[], stored: Record<string, string> = {}) {
  localStorage.setItem("album-tracker:albums", JSON.stringify(albums));
  for (const [key, value] of Object.entries(stored)) {
    localStorage.setItem(key, value);
  }
  return { user: userEvent.setup(), ...render(<App />, { wrapper: NoMotion }) };
}

describe("data safety notices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reminds you to export 30 days after your last export", async () => {
    mockDownloads();
    const { user } = renderApp(ALBUMS, { [LAST_EXPORT_KEY]: daysAgo(45) });

    const reminder = screen.getByRole("alert");
    expect(reminder).toHaveTextContent("You last exported them 45 days ago.");
    await user.click(
      within(reminder).getByRole("button", { name: "Export as JSON" }),
    );

    expect(readJson(await downloadedText()).albums).toEqual(ALBUMS);
    expect(await screen.findByText("Exported 2 albums.")).toBeVisible();
    expect(reminder).not.toBeInTheDocument();
  });

  it("counts an export from the menu too", async () => {
    mockDownloads();
    const { user } = renderApp(ALBUMS, { [LAST_EXPORT_KEY]: daysAgo(45) });
    const reminder = screen.getByRole("alert");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Export as CSV"));

    expect(reminder).not.toBeInTheDocument();
  });

  it("counts the 30 days from your first albums, and again after you dismiss it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 1));
    renderApp(ALBUMS).unmount();

    vi.setSystemTime(new Date(2026, 1, 1));
    const { user, unmount } = renderApp(ALBUMS);
    const reminder = screen.getByRole("alert");
    expect(reminder).toHaveTextContent("You haven't exported them yet.");
    await user.click(within(reminder).getByRole("button", { name: "Dismiss" }));
    expect(reminder).not.toBeInTheDocument();
    unmount();

    vi.setSystemTime(new Date(2026, 1, 28));
    renderApp(ALBUMS);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("suggests adding the app to the Home Screen on an iPhone, until dismissed", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_SAFARI);
    const { user, unmount } = renderApp(ALBUMS);

    const tip = screen.getByRole("alert");
    expect(tip).toHaveTextContent("Add Album Tracker to your Home Screen");
    expect(
      within(tip).getByRole("button", { name: "Export as JSON" }),
    ).toBeVisible();
    await user.click(within(tip).getByRole("button", { name: "Dismiss" }));
    expect(tip).not.toBeInTheDocument();
    unmount();

    renderApp(ALBUMS);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("doesn't suggest the Home Screen inside the Home Screen app", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_SAFARI);
    const matchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      ...matchMedia(query),
      matches: query === "(display-mode: standalone)",
    });
    try {
      renderApp(ALBUMS);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("asks the browser to keep the albums once there are some", async () => {
    const storage = {
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    };
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: storage,
    });
    try {
      renderApp([]).unmount();
      expect(storage.persisted).not.toHaveBeenCalled();

      renderApp(ALBUMS);

      await waitFor(() => expect(storage.persist).toHaveBeenCalled());
    } finally {
      delete (navigator as { storage?: StorageManager }).storage;
    }
  });
});
