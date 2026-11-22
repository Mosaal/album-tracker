import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import { CoverQuery, findCover } from "../../api/coverArt";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

vi.mock("../../api/coverArt", async (importOriginal) => ({
  ...(await importOriginal()),
  findCover: vi.fn(),
}));

const STORAGE_KEY = "album-tracker:albums";
const saved = (): Album[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

const ALBUMS: Album[] = [
  { id: "1", title: "Kind of Blue", artist: "Miles Davis", status: "owned" },
  {
    id: "2",
    title: "In Rainbows",
    artist: "Radiohead",
    status: "owned",
    coverUrl: "https://example.com/in-rainbows.jpg",
  },
  { id: "3", title: "Blue Lines", artist: "Massive Attack", status: "owned" },
];

async function findMissingCovers() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ALBUMS));
  render(<App />, { wrapper: NoMotion });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByText("Find missing covers…"));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("Find covers for 2 albums?");
  expect(dialog).toHaveTextContent("so it takes under a minute");
  await user.click(within(dialog).getByRole("button", { name: "Find covers" }));
  return user;
}

describe("finding missing covers", () => {
  it("looks up the albums without a cover, after asking, and saves those found", async () => {
    vi.mocked(findCover).mockImplementation(async ({ title }: CoverQuery) =>
      title === "Kind of Blue"
        ? "https://example.com/kind-of-blue.jpg"
        : undefined,
    );

    await findMissingCovers();

    expect(
      await screen.findByRole("button", { name: /^Finding covers/ }),
    ).toBeVisible();
    // The second waits about a second, as MusicBrainz asks.
    expect(
      await screen.findByText(
        "Found covers for 1 of 2 albums.",
        {},
        { timeout: 3000 },
      ),
    ).toBeVisible();
    expect(findCover).toHaveBeenCalledTimes(2);
    expect(saved().map(({ coverUrl }) => coverUrl)).toEqual([
      "https://example.com/kind-of-blue.jpg",
      "https://example.com/in-rainbows.jpg",
      undefined,
    ]);
    expect(
      screen.queryByRole("button", { name: /^Finding covers/ }),
    ).toBeNull();
  });

  it("stops when asked", async () => {
    // Never finds anything, until it's cancelled.
    vi.mocked(findCover).mockImplementation(
      (_, signal) =>
        new Promise((_, reject) =>
          signal?.addEventListener("abort", () => reject(signal.reason)),
        ),
    );

    const user = await findMissingCovers();
    await user.click(
      await screen.findByRole("button", {
        name: "Finding covers: 0 of 2 albums looked up, 0 found.",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Stop" }));

    expect(await screen.findByText("Stopped finding covers.")).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /^Finding covers/ }),
      ).toBeNull(),
    );
    expect(saved()).toEqual(ALBUMS);
  });
});
