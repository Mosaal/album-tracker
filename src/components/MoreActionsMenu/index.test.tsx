import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { createCsv, readCsv } from "../../csv";
import { createJson, readJson } from "../../json";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

const STORAGE_KEY = "album-tracker:albums";
const saved = (): Album[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

const ALBUMS: Album[] = [
  { id: "1", title: "Kind of Blue", artist: "Miles Davis", status: "owned" },
  { id: "2", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
  { id: "3", title: "Blue Lines", artist: "Massive Attack", status: "owned" },
];

function renderApp(albums: Album[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
  render(<App />, { wrapper: NoMotion });
  return userEvent.setup();
}

const cardTitles = () =>
  [...document.querySelectorAll(".ant-card-meta-title")].map(
    (title) => title.textContent,
  );

const chooseFile = (file: File) =>
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });

/** Catches downloads, returning the spy on the link that's clicked. */
function mockDownloads() {
  URL.createObjectURL = vi.fn(() => "blob:download");
  URL.revokeObjectURL = vi.fn();
  return vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
}

const downloadedText = () =>
  (vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).text();

describe("more actions menu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports the collection as a JSON file", async () => {
    const click = mockDownloads();
    const user = renderApp(ALBUMS);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Export as JSON"));

    expect(readJson(await downloadedText()).albums).toEqual(ALBUMS);
    expect(click.mock.contexts[0]).toMatchObject({
      download: expect.stringMatching(
        /^album-tracker-\d{4}-\d{2}-\d{2}\.json$/,
      ),
    });
    expect(await screen.findByText("Exported 3 albums.")).toBeVisible();
  });

  it("exports the collection as a CSV file", async () => {
    const click = mockDownloads();
    const user = renderApp(ALBUMS);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Export as CSV"));

    expect(readCsv(await downloadedText()).albums).toEqual(
      ALBUMS.map((album) => ({ ...album, id: expect.any(String) })),
    );
    expect(click.mock.contexts[0]).toMatchObject({
      download: expect.stringMatching(/^album-tracker-\d{4}-\d{2}-\d{2}\.csv$/),
    });
    expect(await screen.findByText("Exported 3 albums.")).toBeVisible();
  });

  it("imports albums from a JSON file, skipping ones already in the collection", async () => {
    const user = renderApp([ALBUMS[0]]);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Import JSON or CSV"));
    chooseFile(new File([createJson(ALBUMS)], "albums.json"));

    expect(
      await screen.findByText(
        "Imported 2 albums. Skipped 1 already in your collection.",
      ),
    ).toBeVisible();
    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);
    expect(saved()).toEqual([
      ALBUMS[0],
      ...ALBUMS.slice(1).map((album) => ({
        ...album,
        addedAt: expect.any(String),
        updatedAt: expect.any(String),
      })),
    ]);
  });

  it("imports albums from a CSV file, skipping ones already in the collection", async () => {
    renderApp([ALBUMS[0]]);

    chooseFile(new File([createCsv(ALBUMS)], "albums.csv"));

    expect(
      await screen.findByText(
        "Imported 2 albums. Skipped 1 already in your collection.",
      ),
    ).toBeVisible();
    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);
  });

  it.each([
    ["notes.json", "{}", "That isn't a JSON file from Album Tracker."],
    [
      "notes.csv",
      "Name,Year\nKind of Blue,1959",
      "That CSV file needs Title and Artist columns.",
    ],
  ])("refuses %s, which it can't import", async (name, contents, error) => {
    renderApp(ALBUMS);

    chooseFile(new File([contents], name));

    expect(await screen.findByText(error)).toBeVisible();
    expect(saved()).toEqual(ALBUMS);
  });
});
