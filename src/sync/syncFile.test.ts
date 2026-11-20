import { describe, expect, it } from "vitest";

import { readJson } from "../files/json";
import { Album, Collection } from "../types";
import {
  createSyncFile,
  describeChanges,
  InvalidSyncFileError,
  NewerSyncFileError,
  readSyncFile,
  UnreadableEntriesError,
} from "./syncFile";

const KIND_OF_BLUE: Album = {
  status: "owned",
  notes: "Mono, from my dad",
  updatedAt: "2026-03-01T10:00:00.000Z",
  title: "Kind of Blue",
  id: "1",
  artist: "Miles Davis",
  format: "vinyl",
  addedAt: "2026-01-01T09:00:00.000Z",
  year: 1959,
};
const IN_RAINBOWS: Album = {
  id: "2",
  title: "In Rainbows",
  artist: "Radiohead",
  status: "wishlisted",
};
const BLUE_LINES: Album = {
  id: "3",
  title: "Blue Lines",
  artist: "Massive Attack",
  status: "owned",
};

const collection = (
  albums: Album[],
  deleted: Collection["deleted"] = [],
): Collection => ({ albums, deleted });

describe("the sync file", () => {
  it("writes albums with their fields in a fixed order, and deletions oldest first", () => {
    const text = createSyncFile(
      collection(
        [KIND_OF_BLUE],
        [
          { id: "9", deletedAt: "2026-03-02T00:00:00.000Z" },
          { id: "8", deletedAt: "2026-03-01T00:00:00.000Z" },
        ],
      ),
    );

    expect(text).toBe(`{
  "format": "album-tracker",
  "version": 2,
  "albums": [
    {
      "id": "1",
      "title": "Kind of Blue",
      "artist": "Miles Davis",
      "year": 1959,
      "format": "vinyl",
      "status": "owned",
      "notes": "Mono, from my dad",
      "addedAt": "2026-01-01T09:00:00.000Z",
      "updatedAt": "2026-03-01T10:00:00.000Z"
    }
  ],
  "deleted": [
    {
      "id": "8",
      "deletedAt": "2026-03-01T00:00:00.000Z"
    },
    {
      "id": "9",
      "deletedAt": "2026-03-02T00:00:00.000Z"
    }
  ]
}
`);
  });

  it("reads back what it writes, and can be imported as a JSON export", () => {
    const saved = collection(
      [KIND_OF_BLUE, IN_RAINBOWS],
      [{ id: "8", deletedAt: "2026-03-01T00:00:00.000Z" }],
    );
    const text = createSyncFile(saved);

    expect(readSyncFile(text)).toEqual(saved);
    expect(readJson(text).albums).toEqual(saved.albums);
  });

  it("refuses a file with entries it can't read, rather than lose them", () => {
    const text = JSON.stringify({
      format: "album-tracker",
      version: 1,
      albums: [IN_RAINBOWS, { title: "Mezzanine", status: "owned" }],
      deleted: [
        { id: "8", deletedAt: "2026-03-01T00:00:00Z" },
        { id: "9", deletedAt: "last week" },
        { deletedAt: "2026-03-01T00:00:00Z" },
      ],
    });

    expect(() => readSyncFile(text)).toThrow(
      expect.objectContaining({ count: 3 }),
    );
    expect(() => readSyncFile(text)).toThrow(UnreadableEntriesError);
  });

  it("gives albums added on GitHub without an id, or with a copied one, an id every read agrees on", () => {
    const mezzanine = {
      title: "Mezzanine",
      artist: "Massive Attack",
      status: "owned",
    };
    const text = JSON.stringify({
      format: "album-tracker",
      version: 1,
      albums: [
        IN_RAINBOWS,
        mezzanine,
        mezzanine,
        { ...IN_RAINBOWS, title: "In Rainbows (Disk 2)" },
      ],
    });

    const { albums } = readSyncFile(text);
    const ids = albums.map((album) => album.id);

    expect(readSyncFile(text).albums.map((album) => album.id)).toEqual(ids);
    expect(new Set(ids).size).toBe(4);
    // The first album with an id keeps it.
    expect(ids[0]).toBe(IN_RAINBOWS.id);
    expect(albums.map((album) => album.title)).toEqual([
      "In Rainbows",
      "Mezzanine",
      "Mezzanine",
      "In Rainbows (Disk 2)",
    ]);
  });

  it("reads a JSON export, which has no deletions", () => {
    const text = JSON.stringify({
      format: "album-tracker",
      version: 1,
      exportedAt: "2026-03-01T00:00:00.000Z",
      albums: [IN_RAINBOWS],
    });

    expect(readSyncFile(text)).toEqual(collection([IN_RAINBOWS]));
  });

  it.each([
    ["isn't JSON", "# My albums"],
    ["isn't from Album Tracker", JSON.stringify({ albums: [] })],
    ["has no album list", JSON.stringify({ format: "album-tracker" })],
    [
      "has deleted albums that aren't a list",
      JSON.stringify({ format: "album-tracker", albums: [], deleted: {} }),
    ],
  ])("refuses a file that %s", (_, text) => {
    expect(() => readSyncFile(text)).toThrow(InvalidSyncFileError);
  });

  it("refuses a file from a newer version of the app", () => {
    const text = JSON.stringify({
      format: "album-tracker",
      version: 3,
      albums: [],
    });

    expect(() => readSyncFile(text)).toThrow(NewerSyncFileError);
  });
});

describe("describeChanges", () => {
  const before = collection([KIND_OF_BLUE, IN_RAINBOWS]);
  const later = "2026-03-05T00:00:00.000Z";

  it.each<[string, Collection | undefined, Collection, string]>([
    ["starting", undefined, before, "Start syncing 2 albums"],
    [
      "adding one",
      before,
      collection([KIND_OF_BLUE, IN_RAINBOWS, BLUE_LINES]),
      'Add "Blue Lines" by Massive Attack',
    ],
    [
      "editing one",
      before,
      collection([
        KIND_OF_BLUE,
        { ...IN_RAINBOWS, title: "In Rainbows (Disk 2)" },
      ]),
      'Edit "In Rainbows (Disk 2)" by Radiohead',
    ],
    [
      "deleting one",
      before,
      collection([KIND_OF_BLUE], [{ id: "2", deletedAt: later }]),
      'Delete "In Rainbows" by Radiohead',
    ],
    [
      "marking one",
      before,
      collection([
        KIND_OF_BLUE,
        { ...IN_RAINBOWS, status: "owned", updatedAt: later },
      ]),
      'Mark "In Rainbows" by Radiohead as owned',
    ],
    [
      "marking several",
      collection([
        KIND_OF_BLUE,
        IN_RAINBOWS,
        { ...BLUE_LINES, status: "wishlisted" },
      ]),
      collection([
        KIND_OF_BLUE,
        { ...IN_RAINBOWS, status: "owned", updatedAt: later },
        { ...BLUE_LINES, updatedAt: later },
      ]),
      "Mark 2 albums as owned",
    ],
    [
      "marking and editing",
      before,
      collection([
        { ...KIND_OF_BLUE, title: "Kind of Blue (Legacy)" },
        { ...IN_RAINBOWS, status: "owned" },
      ]),
      "Edit 2 albums",
    ],
    [
      "a mix",
      before,
      collection(
        [
          { ...KIND_OF_BLUE, format: "cd" },
          BLUE_LINES,
          { ...BLUE_LINES, id: "4" },
        ],
        [{ id: "2", deletedAt: later }],
      ),
      "Add 2 albums, edit 1 and delete 1",
    ],
    [
      "only deletions",
      before,
      collection(before.albums, [{ id: "8", deletedAt: later }]),
      "Record deleted albums",
    ],
    [
      "only the order",
      before,
      collection([IN_RAINBOWS, KIND_OF_BLUE]),
      "Update albums",
    ],
  ])("describes %s", (_, from, to, message) => {
    expect(describeChanges(from, to)).toBe(message);
  });
});
