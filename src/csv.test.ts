import { describe, expect, it } from "vitest";

import { createCsv, InvalidCsvError, readCsv } from "./csv";
import { Album } from "./types";

const ALBUMS: Album[] = [
  {
    id: "1",
    title: 'Hello, "World"',
    artist: "Björk",
    year: 2001,
    coverUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
    format: "vinyl",
    status: "owned",
    notes: "Signed\nFirst pressing",
  },
  { id: "2", title: "=", artist: "Ed Sheeran", status: "wishlisted" },
];

// CSV files don't keep ids, so every album read from one gets a new id.
const newId = { id: expect.any(String) };

describe("createCsv", () => {
  it("writes a header row, quotes cells that need it and keeps formulas as text", () => {
    expect(createCsv(ALBUMS)).toBe(
      "\uFEFF" +
        "Title,Artist,Year,Format,Status,Cover URL,Notes\r\n" +
        '"Hello, ""World""",Björk,2001,Vinyl,Owned,https://coverartarchive.org/release-group/rg-1/front-500,"Signed\nFirst pressing"\r\n' +
        "'=,Ed Sheeran,,,Wishlisted,,\r\n",
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
          notes: "Signed",
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
    ["1959", 1959],
    ["1959-08-17", 1959],
    ["59", undefined],
    ["19590", undefined],
    ["Unknown", undefined],
  ])(
    "reads the year %j as %s, keeping the album either way",
    (year, expected) => {
      const [album] = readCsv(
        `Title,Artist,Year\nKind of Blue,Miles Davis,${year}\n`,
      ).albums;

      expect(album.title).toBe("Kind of Blue");
      expect(album.year).toBe(expected);
    },
  );

  it("reads the year and notes from a Discogs collection export", () => {
    const [album] = readCsv(
      "Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Collection Media Condition,Collection Sleeve Condition,Collection Notes\r\n" +
        'CL 1355,Miles Davis,Kind of Blue,Columbia,"LP, Album, Mono",,1959,2537435,Uncategorized,2024-05-01 10:00:00,Very Good Plus (VG+),Very Good (VG),"Signed, sleeve worn"\r\n',
    ).albums;

    expect(album).toEqual({
      ...newId,
      title: "Kind of Blue",
      artist: "Miles Davis",
      year: 1959,
      format: "vinyl",
      status: "owned",
      notes: "Signed, sleeve worn",
    });
  });

  it.each([
    ["other columns", "Name,Year\nKind of Blue,1959\n"],
    ["no header row", "Kind of Blue,Miles Davis\n"],
    ["nothing in it", ""],
  ])("rejects a file with %s", (_, text) => {
    expect(() => readCsv(text)).toThrow(InvalidCsvError);
  });
});
