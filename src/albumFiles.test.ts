import { describe, expect, it } from "vitest";

import { describeImport, mergeAlbums } from "./albumFiles";
import { Album } from "./types";

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
