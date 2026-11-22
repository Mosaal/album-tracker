import { describe, expect, it } from "vitest";

import { Album } from "../types";
import {
  describeImport,
  describeMusicImport,
  matchFoundAlbums,
  mergeAlbums,
} from "./albumFiles";

const KIND_OF_BLUE: Album = {
  id: "1",
  title: "Kind of Blue",
  artist: "Miles Davis",
  status: "owned",
};
const IN_RAINBOWS: Album = {
  id: "2",
  title: "In Rainbows",
  artist: "Radiohead",
  status: "wishlisted",
};

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

  it("tells copies of an album apart by format, unless one has no format", () => {
    const vinyl: Album = { ...KIND_OF_BLUE, format: "vinyl" };
    const cd: Album = { ...KIND_OF_BLUE, id: "3", format: "cd" };
    const noFormat: Album = { ...KIND_OF_BLUE, id: "4" };

    const result = mergeAlbums([vinyl], [cd, noFormat]);

    expect(result.albums).toEqual([vinyl, cd]);
    expect(result.skipped).toBe(1);
    expect(mergeAlbums([noFormat], [cd]).skipped).toBe(1);
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

describe("matchFoundAlbums", () => {
  it("tells albums owned, on the wishlist, owned in another format and new apart", () => {
    const collection: Album[] = [
      { ...KIND_OF_BLUE, format: "digital" },
      // Without a format, it could be the same copy.
      {
        id: "3",
        title: "Blue Train",
        artist: "John Coltrane",
        status: "owned",
      },
      IN_RAINBOWS,
      ...(["vinyl", "cd"] as const).map((format) => ({
        id: format,
        title: "Blue Lines",
        artist: "Massive Attack",
        status: "owned" as const,
        format,
      })),
      // Wanted on vinyl, which a digital copy doesn't make owned.
      {
        id: "5",
        title: "Mezzanine",
        artist: "Massive Attack",
        status: "wishlisted",
        format: "vinyl",
      },
    ];

    expect(
      matchFoundAlbums(
        collection,
        [
          { title: "kind of blue", artist: " Miles Davis" },
          { title: "Blue Train", artist: "John Coltrane" },
          { title: "In Rainbows", artist: "Radiohead" },
          { title: "Blue Lines", artist: "Massive Attack" },
          { title: "Mezzanine", artist: "Massive Attack" },
          { title: "Heligoland", artist: "Massive Attack" },
        ],
        "digital",
      ),
    ).toEqual([
      { kind: "owned" },
      { kind: "owned" },
      { kind: "wishlisted", id: "2" },
      { kind: "other-format", formats: ["vinyl", "cd"] },
      { kind: "new" },
      { kind: "new" },
    ]);
  });
});

describe("describeMusicImport", () => {
  it.each([
    [{ added: 1, markedOwned: 0, skipped: 0 }, "Imported 1 album."],
    [
      { added: 380, markedOwned: 3, skipped: 0 },
      "Imported 380 albums and marked 3 albums on your wishlist as owned.",
    ],
    [
      { added: 0, markedOwned: 1, skipped: 2 },
      "Marked 1 album on your wishlist as owned. Skipped 2 already in your collection.",
    ],
    [
      { added: 0, markedOwned: 0, skipped: 1 },
      "No new albums to import. Skipped 1 already in your collection.",
    ],
  ])("summarises %o", (summary, message) => {
    expect(describeMusicImport(summary)).toBe(message);
  });
});
