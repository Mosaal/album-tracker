import { describe, expect, it } from "vitest";

import { createCsv, InvalidCsvError, readCsv } from "./csv";
import { Album } from "./types";

const ALBUMS: Album[] = [
  {
    id: "1",
    title: 'Hello, "World"',
    artist: "Björk",
    coverUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
    format: "vinyl",
    status: "owned",
  },
  { id: "2", title: "=", artist: "Ed Sheeran", status: "wishlisted" },
];

// CSV files don't keep ids, so every album read from one gets a new id.
const newId = { id: expect.any(String) };

describe("createCsv", () => {
  it("writes a header row, quotes cells that need it and keeps formulas as text", () => {
    expect(createCsv(ALBUMS)).toBe(
      "\uFEFF" +
        "Title,Artist,Format,Status,Cover URL\r\n" +
        '"Hello, ""World""",Björk,Vinyl,Owned,https://coverartarchive.org/release-group/rg-1/front-500\r\n' +
        "'=,Ed Sheeran,,Wishlisted,\r\n",
    );
  });
});

describe("readCsv", () => {
  it("reads back what createCsv writes", () => {
    expect(readCsv(createCsv(ALBUMS))).toEqual({
      albums: ALBUMS.map((album) => ({ ...album, ...newId })),
      unreadable: 0,
    });
  });

  it.each([
    ["semicolons", "Artist;Album;Notes\nRadiohead;In Rainbows;Signed\n"],
    ["tabs", "Artist\tAlbum\tNotes\nRadiohead\tIn Rainbows\tSigned\n"],
  ])(
    "reads files that use %s, with columns in any order and no Status column",
    (_, text) => {
      expect(readCsv(text).albums).toEqual([
        {
          ...newId,
          title: "In Rainbows",
          artist: "Radiohead",
          status: "owned",
        },
      ]);
    },
  );

  it("skips blank rows and counts the rows it can't use", () => {
    const { albums, unreadable } = readCsv(
      [
        "title,artist,status",
        "Kind of Blue,Miles Davis,WISHLISTED",
        "In Rainbows,Radiohead,",
        ",,",
        "",
        "Blue Lines,,owned",
        "OK Computer,Radiohead,borrowed",
      ].join("\r\n"),
    );

    expect(albums).toEqual([
      {
        ...newId,
        title: "Kind of Blue",
        artist: "Miles Davis",
        status: "wishlisted",
      },
      { ...newId, title: "In Rainbows", artist: "Radiohead", status: "owned" },
    ]);
    expect(unreadable).toBe(2);
  });

  it.each([
    ["CD", "cd"],
    ["2xLP, Album, RE", "vinyl"],
    ["Cass, Album", "cassette"],
    ["File, FLAC", "digital"],
    ["Betamax", "other"],
    ["", undefined],
  ])("reads the format %j as %s, by name or synonym", (format, expected) => {
    const [album] = readCsv(
      `Title,Artist,Format\nKind of Blue,Miles Davis,"${format}"\n`,
    ).albums;

    expect(album.format).toBe(expected);
  });

  it.each([
    ["other columns", "Name,Year\nKind of Blue,1959\n"],
    ["no header row", "Kind of Blue,Miles Davis\n"],
    ["nothing in it", ""],
  ])("rejects a file with %s", (_, text) => {
    expect(() => readCsv(text)).toThrow(InvalidCsvError);
  });
});
