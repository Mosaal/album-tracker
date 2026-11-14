import { describe, expect, it } from "vitest";

import {
  createBackup,
  describeImport,
  InvalidBackupError,
  mergeAlbums,
  readBackup,
} from "./backup";
import { Album } from "./types";

const KIND_OF_BLUE: Album = {
  id: "1",
  title: "Kind of Blue",
  artist: "Miles Davis",
  coverUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
  status: "owned",
};
const IN_RAINBOWS: Album = {
  id: "2",
  title: "In Rainbows",
  artist: "Radiohead",
  status: "wishlisted",
};

const backupOf = (albums: unknown[]) =>
  JSON.stringify({ format: "album-tracker", version: 1, albums });

describe("readBackup", () => {
  it("reads back what createBackup writes", () => {
    expect(readBackup(createBackup([KIND_OF_BLUE, IN_RAINBOWS]))).toEqual({
      albums: [KIND_OF_BLUE, IN_RAINBOWS],
      unreadable: 0,
    });
  });

  it.each([
    ["text that isn't JSON", "not json"],
    ["JSON from something else", JSON.stringify({ albums: [] })],
    [
      "a backup without an album list",
      JSON.stringify({ format: "album-tracker" }),
    ],
  ])("rejects %s", (_, text) => {
    expect(() => readBackup(text)).toThrow(InvalidBackupError);
  });

  it("skips entries it can't use and counts them", () => {
    const { albums, unreadable } = readBackup(
      backupOf([
        IN_RAINBOWS,
        { ...IN_RAINBOWS, id: "3", title: "  " },
        { ...IN_RAINBOWS, id: "4", status: "borrowed" },
        "not an album",
      ]),
    );

    expect(albums).toEqual([IN_RAINBOWS]);
    expect(unreadable).toBe(3);
  });

  it("tidies up albums: trims text, drops bad cover URLs and adds missing ids", () => {
    const { albums } = readBackup(
      backupOf([
        {
          title: " Kind of Blue ",
          artist: "Miles Davis",
          status: "owned",
          coverUrl: "javascript:alert(1)",
        },
      ]),
    );

    expect(albums).toEqual([
      {
        id: expect.any(String),
        title: "Kind of Blue",
        artist: "Miles Davis",
        status: "owned",
      },
    ]);
  });
});

describe("mergeAlbums", () => {
  it("adds new albums after the existing ones", () => {
    expect(mergeAlbums([KIND_OF_BLUE], [IN_RAINBOWS])).toEqual({
      albums: [KIND_OF_BLUE, IN_RAINBOWS],
      added: 1,
      skipped: 0,
    });
  });

  it("skips albums already in the collection by id, or by title and artist", () => {
    const sameId = { ...IN_RAINBOWS, id: KIND_OF_BLUE.id };
    const sameAlbum = {
      ...KIND_OF_BLUE,
      id: "99",
      title: "KIND OF BLUE ",
      status: "wishlisted" as const,
    };

    const result = mergeAlbums([KIND_OF_BLUE], [sameId, sameAlbum]);

    expect(result.albums).toEqual([KIND_OF_BLUE]);
    expect(result.skipped).toBe(2);
  });

  it("adds an album only once when the file repeats it", () => {
    const result = mergeAlbums([], [IN_RAINBOWS, { ...IN_RAINBOWS, id: "3" }]);

    expect(result.albums).toEqual([IN_RAINBOWS]);
    expect(result).toMatchObject({ added: 1, skipped: 1 });
  });
});

describe("describeImport", () => {
  it.each([
    [{ added: 1, skipped: 0, unreadable: 0 }, "Imported 1 album."],
    [
      { added: 3, skipped: 2, unreadable: 1 },
      "Imported 3 albums. Skipped 2 already in your collection and 1 that couldn't be read.",
    ],
    [
      { added: 0, skipped: 4, unreadable: 0 },
      "No new albums to import. Skipped 4 already in your collection.",
    ],
  ])("summarises %o", (summary, message) => {
    expect(describeImport(summary)).toBe(message);
  });
});
