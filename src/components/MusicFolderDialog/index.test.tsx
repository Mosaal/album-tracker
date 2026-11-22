import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ICommonTagsResult } from "music-metadata";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import { findCover } from "../../api/coverArt";
import { COVER_ART_URL } from "../../api/musicBrainz";
import { NoMotion } from "../../test/NoMotion";
import { Album } from "../../types";

const { parseBlob } = vi.hoisted(() => ({ parseBlob: vi.fn() }));
vi.mock("music-metadata", () => ({ parseBlob }));
// Covers for albums without one are looked up after importing.
vi.mock("../../api/coverArt", async (importOriginal) => ({
  ...(await importOriginal()),
  findCover: vi.fn(async () => undefined),
}));

const STORAGE_KEY = "album-tracker:albums";
const saved = (): Album[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

const OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433";
const IN_RAINBOWS = "6e335887-60ba-38f0-95af-fae7774336bf";

const COLLECTION: Album[] = [
  { id: "1", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
  {
    id: "2",
    title: "Kind of Blue",
    artist: "Miles Davis",
    status: "owned",
    format: "vinyl",
  },
  { id: "3", title: "Blue Lines", artist: "Massive Attack", status: "owned" },
];

// Each album's folder in the music folder, and its files' tags.
const MUSIC: Record<string, Partial<ICommonTagsResult>> = {
  "Radiohead/OK Computer": {
    album: "OK Computer",
    artist: "Radiohead",
    originaldate: "1997-05-21",
    musicbrainz_releasegroupid: OK_COMPUTER,
  },
  "Radiohead/In Rainbows": {
    album: "In Rainbows",
    artist: "Radiohead",
    musicbrainz_releasegroupid: IN_RAINBOWS,
  },
  "Miles Davis/Kind of Blue": { album: "Kind of Blue", artist: "Miles Davis" },
  "Massive Attack/Blue Lines": {
    album: "Blue Lines",
    artist: "Massive Attack",
  },
  "Radiohead/Creep": {
    album: "Creep",
    artist: "Radiohead",
    releasetype: ["single"],
  },
};

/** Files as a folder picker gives them, with their paths in "Music". */
const musicFolder = (paths: string[]) =>
  paths.map((path) => {
    const file = new File(["…"], path.split("/").pop()!);
    Object.defineProperty(file, "webkitRelativePath", {
      value: `Music/${path}`,
    });
    return file;
  });

const tagsOf = (file: File) => {
  const folder = file.webkitRelativePath.split("/").slice(1, -1).join("/");
  return {
    track: { no: null, of: null },
    disk: { no: null, of: null },
    ...MUSIC[folder],
  } as ICommonTagsResult;
};

async function openDialog() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(COLLECTION));
  render(<App />, { wrapper: NoMotion });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "More actions" }));
  await user.click(await screen.findByText("Import music folder…"));
  const dialog = await screen.findByRole("dialog");
  // Loaded when it's first opened, the dialog appears with an animation, which
  // jsdom only ends after a while.
  await waitFor(() => expect(dialog).toBeVisible());
  const chooseFiles = (files: File[]) =>
    fireEvent.change(dialog.querySelector('input[type="file"]')!, {
      target: { files },
    });
  return { user, dialog, chooseFiles };
}

describe("importing a music folder", () => {
  it("adds the albums ticked as owned, in the format chosen", async () => {
    parseBlob.mockImplementation(async (file: File) => ({
      common: tagsOf(file),
    }));
    const { user, dialog, chooseFiles } = await openDialog();

    chooseFiles(
      musicFolder([
        ...Object.keys(MUSIC)
          .filter((folder) => folder !== "Radiohead/Creep")
          .flatMap((folder) =>
            ["01", "02", "03"].map((track) => `${folder}/${track}.mp3`),
          ),
        "Radiohead/Creep/01.mp3",
        "Radiohead/OK Computer/cover.jpg",
      ]),
    );

    expect(
      await within(dialog).findByText("Found 5 albums in 13 music files."),
    ).toBeVisible();
    const importButton = within(dialog).getByRole("button", {
      name: "Import",
    });
    expect(importButton).toBeDisabled();

    // Nothing is listed until there's a format, as it decides what's new.
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    await user.click(
      within(dialog).getByRole("combobox", { name: "Mark all as" }),
    );
    await user.click(
      document.querySelector('.ant-select-item-option[title="Digital"]')!,
    );

    const album = (title: RegExp) =>
      within(dialog).getByRole("checkbox", { name: title });
    expect(album(/OK Computer/)).toBeChecked();
    expect(album(/In Rainbows/)).toBeChecked();
    expect(album(/In Rainbows/)).toHaveAccessibleName(
      /On your wishlist: will be marked owned/,
    );
    expect(album(/Kind of Blue/)).not.toBeChecked();
    expect(album(/Kind of Blue/)).toHaveAccessibleName(/Owned as Vinyl/);
    expect(album(/Creep/)).not.toBeChecked();
    expect(album(/Creep/)).toHaveAccessibleName(/Single/);
    expect(
      within(dialog).queryByRole("checkbox", { name: /Blue Lines/ }),
    ).toBeNull();
    expect(
      within(dialog).getByText(
        "1 album already in your collection isn't listed.",
      ),
    ).toBeVisible();

    await user.click(album(/Kind of Blue/));
    await user.click(
      within(dialog).getByRole("button", { name: "Import 3 albums" }),
    );

    expect(
      await screen.findByText(
        "Imported 2 albums and marked 1 album on your wishlist as owned.",
      ),
    ).toBeVisible();
    expect(saved()).toEqual([
      // Marked owned, with the format chosen and the cover its files name.
      {
        ...COLLECTION[0],
        status: "owned",
        format: "digital",
        coverUrl: `${COVER_ART_URL}/${IN_RAINBOWS}/front-500`,
        updatedAt: expect.any(String),
      },
      COLLECTION[1],
      COLLECTION[2],
      expect.objectContaining({
        title: "Kind of Blue",
        artist: "Miles Davis",
        format: "digital",
        status: "owned",
      }),
      expect.objectContaining({
        title: "OK Computer",
        artist: "Radiohead",
        year: 1997,
        coverUrl: `${COVER_ART_URL}/${OK_COMPUTER}/front-500`,
        format: "digital",
        status: "owned",
      }),
    ]);
    // Kind of Blue, still without a cover, has one looked up.
    await waitFor(() =>
      expect(findCover).toHaveBeenCalledExactlyOnceWith(
        { title: "Kind of Blue", artist: "Miles Davis", year: undefined },
        expect.any(AbortSignal),
      ),
    );
  });

  it("says when a folder has no music, and stops reading when cancelled", async () => {
    // Reading never finishes, so it can be cancelled.
    parseBlob.mockImplementation(() => new Promise(() => {}));
    const { user, dialog, chooseFiles } = await openDialog();

    chooseFiles(musicFolder(["Pictures/cover.jpg", "notes.txt"]));
    expect(
      await within(dialog).findByText("There's no music in that folder."),
    ).toBeVisible();

    chooseFiles(musicFolder(["Radiohead/OK Computer/01.mp3"]));
    expect(
      await within(dialog).findByText("Reading 0 of 1 file…"),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(
      within(dialog).getByRole("button", { name: /choose files/i }),
    ).toBeVisible();
    expect(saved()).toEqual(COLLECTION);
  });
});
