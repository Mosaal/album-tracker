import type { ICommonTagsResult } from "music-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readTracks, toTrack } from "./musicTags";

const { parseBlob } = vi.hoisted(() => ({ parseBlob: vi.fn() }));
vi.mock("music-metadata", () => ({ parseBlob }));

const tags = (common: Partial<ICommonTagsResult>) =>
  ({
    track: { no: null, of: null },
    disk: { no: null, of: null },
    ...common,
  }) as ICommonTagsResult;

/** A file as a folder picker gives it, with its path in the folder chosen. */
function fileAt(path: string) {
  const file = new File(["…"], path.split("/").pop()!);
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("toTrack", () => {
  it("reads the tags MusicBrainz Picard writes", () => {
    expect(
      toTrack(
        ["Radiohead", "OK Computer"],
        tags({
          album: " OK Computer ",
          albumartist: "Radiohead",
          artist: "Radiohead",
          year: 2017,
          date: "2017-06-23",
          // Picard writes the original date, but not always the year.
          originaldate: "1997-05-21",
          musicbrainz_releasegroupid: "B1392450-E666-3926-A536-22C65F834433",
          releasetype: ["Album"],
          disk: { no: 1, of: 1 },
          track: { no: 3, of: 12 },
        }),
      ),
    ).toEqual({
      folders: ["Radiohead", "OK Computer"],
      album: "OK Computer",
      albumArtist: "Radiohead",
      artist: "Radiohead",
      originalYear: 1997,
      year: 2017,
      releaseGroupId: "b1392450-e666-3926-a536-22c65f834433",
      compilation: false,
      disc: 1,
      track: 3,
      tracksOnDisc: 12,
      releaseTypes: ["album"],
    });
  });

  it("ignores a release group id that isn't one", () => {
    expect(
      toTrack([], tags({ musicbrainz_releasegroupid: "../../etc" }))
        ?.releaseGroupId,
    ).toBeUndefined();
  });

  it.each([
    ["an audiobook", { stik: 2 }],
    ["a podcast", { podcast: true }],
    ["a podcast episode, by its genre", { genre: ["Podcast"] }],
  ])("leaves out %s", (_, common) => {
    expect(toTrack([], tags(common))).toBeUndefined();
  });
});

describe("readTracks", () => {
  afterEach(() => {
    parseBlob.mockReset();
  });

  it("reads music files only, with their folders below the one chosen", async () => {
    parseBlob.mockImplementation(async (file: File) => {
      if (file.name === "broken.mp3") {
        throw new Error("Failed to determine audio format");
      }
      return { common: tags({ album: file.name }) };
    });
    const onProgress = vi.fn();

    const result = await readTracks(
      [
        fileAt("Music/Radiohead/OK Computer/01 Airbag.mp3"),
        fileAt("Music/Radiohead/OK Computer/cover.jpg"),
        fileAt("Music/Radiohead/OK Computer/._01 Airbag.mp3"),
        fileAt("Music/.Trashes/501/old.flac"),
        // Not hidden, despite the dot.
        fileAt("Music/Metallica/...And Justice for All/01 Blackened.mp3"),
        fileAt("Music/Books/A Book.m4b"),
        fileAt("Music/Loose.FLAC"),
        fileAt("Music/broken.mp3"),
        // Picked on its own, rather than in a folder.
        new File(["…"], "Single.m4a"),
      ],
      { onProgress },
    );

    expect(parseBlob).toHaveBeenCalledTimes(5);
    expect(result).toEqual({
      tracks: [
        expect.objectContaining({
          folders: ["Radiohead", "OK Computer"],
          album: "01 Airbag.mp3",
        }),
        expect.objectContaining({
          folders: ["Metallica", "...And Justice for All"],
        }),
        expect.objectContaining({ folders: [], album: "Loose.FLAC" }),
        expect.objectContaining({ folders: [], album: "Single.m4a" }),
      ],
      files: 5,
      unreadable: 1,
    });
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    parseBlob.mockImplementation(async () => {
      controller.abort();
      return { common: tags({}) };
    });
    const files = Array.from({ length: 20 }, (_, index) =>
      fileAt(`Music/${index}.mp3`),
    );

    await expect(
      readTracks(files, { signal: controller.signal }),
    ).rejects.toThrow(/abort/i);
    expect(parseBlob.mock.calls.length).toBeLessThan(files.length);
  });
});
