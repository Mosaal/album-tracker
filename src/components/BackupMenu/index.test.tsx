import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../App";
import { createBackup, readBackup } from "../../backup";
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

describe("backup menu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports the collection to a backup file", async () => {
    URL.createObjectURL = vi.fn(() => "blob:backup");
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = renderApp(ALBUMS);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Export backup"));

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(readBackup(await blob.text()).albums).toEqual(ALBUMS);
    expect(click.mock.contexts[0]).toMatchObject({
      download: expect.stringMatching(
        /^album-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/,
      ),
    });
    expect(await screen.findByText("Exported 3 albums.")).toBeVisible();
  });

  it("imports albums from a backup, skipping ones already in the collection", async () => {
    const user = renderApp([ALBUMS[0]]);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByText("Import backup"));
    chooseFile(new File([createBackup(ALBUMS)], "backup.json"));

    expect(
      await screen.findByText(
        "Imported 2 albums. Skipped 1 already in your collection.",
      ),
    ).toBeVisible();
    expect(cardTitles()).toEqual(["Blue Lines", "In Rainbows", "Kind of Blue"]);
    expect(saved()).toEqual(ALBUMS);
  });

  it("refuses files that aren't backups", async () => {
    renderApp(ALBUMS);

    chooseFile(new File(["{}"], "notes.json"));

    expect(
      await screen.findByText("That file isn't an Album Tracker backup."),
    ).toBeVisible();
    expect(saved()).toEqual(ALBUMS);
  });
});
