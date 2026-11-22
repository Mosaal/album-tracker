import { describe, expect, it } from "vitest";

import { Album, AlbumSortOrder } from "../types";
import {
  AlbumGroup,
  groupAlbums,
  listArtists,
  listDecades,
  selectAlbums,
} from "./albumList";

// Stored oldest first, in the order they were added.
const ALBUMS: Album[] = [
  {
    id: "1",
    title: "Kind of Blue",
    artist: "Miles Davis",
    format: "vinyl",
    status: "owned",
  },
  {
    id: "2",
    title: "Blue Lines",
    artist: "Massive Attack",
    format: "vinyl",
    status: "wishlisted",
  },
  {
    id: "3",
    title: "Mezzanine",
    artist: "Massive Attack",
    format: "cd",
    status: "owned",
  },
  { id: "4", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
];

const titles = (albums: Album[]) => albums.map((album) => album.title);

/** Each section's heading, with the titles of its albums. */
const sections = (groups: AlbumGroup[]) =>
  groups.map(({ label, albums }) => [label, titles(albums)]);
const headings = (groups: AlbumGroup[]) => groups.map(({ label }) => label);

const select = (options: Partial<Parameters<typeof selectAlbums>[1]>) =>
  selectAlbums(ALBUMS, {
    search: "",
    sortOrder: "title-asc",
    statusFilter: "all",
    formatFilter: "all",
    ...options,
  });

describe("selectAlbums", () => {
  it("lists the most recently added albums first", () => {
    expect(titles(select({ sortOrder: "recent" }))).toEqual([
      "In Rainbows",
      "Mezzanine",
      "Blue Lines",
      "Kind of Blue",
    ]);
  });

  it("keeps the newest-first order within a search and status filter", () => {
    const visible = select({
      search: "massive",
      sortOrder: "recent",
      statusFilter: "all",
    });

    expect(titles(visible)).toEqual(["Mezzanine", "Blue Lines"]);
  });

  it("goes by when albums were added when it knows, then lists the rest newest first", () => {
    // A synced album can be stored after one added later on this device.
    const [kindOfBlue, blueLines, mezzanine, inRainbows] = ALBUMS;
    const albums = [
      kindOfBlue,
      blueLines,
      { ...mezzanine, addedAt: "2026-03-05T12:00:00.000Z" },
      { ...inRainbows, addedAt: "2026-03-01T12:00:00.000Z" },
    ];

    const visible = selectAlbums(albums, {
      search: "",
      sortOrder: "recent",
      statusFilter: "all",
      formatFilter: "all",
    });

    expect(titles(visible)).toEqual([
      "Mezzanine",
      "In Rainbows",
      "Blue Lines",
      "Kind of Blue",
    ]);
  });

  it("shows albums that match both the search, in any case, and the status", () => {
    const visible = select({ search: "MASSIVE", statusFilter: "owned" });

    expect(titles(visible)).toEqual(["Mezzanine"]);
  });

  it("shows only the chosen artist's albums, whatever the case", () => {
    expect(titles(select({ artistFilter: "massive attack " }))).toEqual([
      "Blue Lines",
      "Mezzanine",
    ]);
  });

  it("shows only albums in the chosen format", () => {
    expect(titles(select({ formatFilter: "vinyl" }))).toEqual([
      "Blue Lines",
      "Kind of Blue",
    ]);
  });

  it("leaves the stored order alone when sorting", () => {
    select({ sortOrder: "recent" });
    select({ sortOrder: "title-desc" });

    expect(titles(ALBUMS)).toEqual([
      "Kind of Blue",
      "Blue Lines",
      "Mezzanine",
      "In Rainbows",
    ]);
  });
});

describe("listArtists", () => {
  it("lists each artist once, alphabetically, spelt as first added", () => {
    expect(
      listArtists([
        ...ALBUMS,
        { ...ALBUMS[1], id: "5", artist: "massive attack" },
        { ...ALBUMS[0], id: "6", artist: " Björk " },
      ]),
    ).toEqual(["Björk", "Massive Attack", "Miles Davis", "Radiohead"]);
  });
});

describe("groupAlbums", () => {
  it("groups by artist, whatever the case, A to Z, or Z to A when sorted that way", () => {
    const albums: Album[] = [
      ...ALBUMS,
      {
        id: "5",
        title: "Heligoland",
        artist: "massive attack",
        status: "owned",
      },
    ];
    const visible = selectAlbums(albums, {
      search: "",
      sortOrder: "title-asc",
      statusFilter: "all",
      formatFilter: "all",
    });

    expect(sections(groupAlbums(visible, "artist", "title-asc"))).toEqual([
      ["Massive Attack", ["Blue Lines", "Heligoland", "Mezzanine"]],
      ["Miles Davis", ["Kind of Blue"]],
      ["Radiohead", ["In Rainbows"]],
    ]);
    expect(
      headings(
        groupAlbums(
          select({ sortOrder: "artist-desc" }),
          "artist",
          "artist-desc",
        ),
      ),
    ).toEqual(["Radiohead", "Miles Davis", "Massive Attack"]);
  });

  it("groups by format, in the usual order, with albums that have none last", () => {
    expect(sections(groupAlbums(select({}), "format", "title-asc"))).toEqual([
      ["Vinyl", ["Blue Lines", "Kind of Blue"]],
      ["CD", ["Mezzanine"]],
      ["No format", ["In Rainbows"]],
    ]);
  });

  describe("by letter", () => {
    const FILED: Album[] = [
      ...ALBUMS,
      {
        id: "5",
        title: "(What's the Story) Morning Glory?",
        artist: "Oasis",
        status: "owned",
      },
      { id: "6", title: "1989", artist: "Taylor Swift", status: "owned" },
      { id: "7", title: "Ágætis byrjun", artist: "Sigur Rós", status: "owned" },
    ];
    const groupFiled = (sortOrder: AlbumSortOrder) =>
      groupAlbums(
        selectAlbums(FILED, {
          search: "",
          sortOrder,
          statusFilter: "all",
          formatFilter: "all",
        }),
        "letter",
        sortOrder,
      );

    it("files titles under their first letter, without accents or punctuation, and numbers under # last", () => {
      expect(sections(groupFiled("title-asc"))).toEqual([
        ["A", ["Ágætis byrjun"]],
        ["B", ["Blue Lines"]],
        ["I", ["In Rainbows"]],
        ["K", ["Kind of Blue"]],
        ["M", ["Mezzanine"]],
        ["W", ["(What's the Story) Morning Glory?"]],
        ["#", ["1989"]],
      ]);
    });

    it("files by artist when sorting by artist, and runs backwards when sorting backwards", () => {
      expect(sections(groupFiled("artist-asc"))).toEqual([
        ["M", ["Blue Lines", "Mezzanine", "Kind of Blue"]],
        ["O", ["(What's the Story) Morning Glory?"]],
        ["R", ["In Rainbows"]],
        ["S", ["Ágætis byrjun"]],
        ["T", ["1989"]],
      ]);
      expect(headings(groupFiled("title-desc"))).toEqual([
        "W",
        "M",
        "K",
        "I",
        "B",
        "A",
        "#",
      ]);
    });
  });
});

describe("years", () => {
  // Two from 1998, as albums from the same year go by artist, then title.
  const [kindOfBlue, blueLines, mezzanine, inRainbows] = ALBUMS;
  const DATED: Album[] = [
    { ...kindOfBlue, year: 1959 },
    { ...blueLines, year: 1991 },
    { ...mezzanine, year: 1998 },
    inRainbows,
    {
      id: "5",
      title: "Mutations",
      artist: "Beck",
      status: "owned",
      year: 1998,
    },
  ];
  const selectDated = (options: Partial<Parameters<typeof selectAlbums>[1]>) =>
    selectAlbums(DATED, {
      search: "",
      sortOrder: "title-asc",
      statusFilter: "all",
      formatFilter: "all",
      ...options,
    });

  it("sorts oldest or newest first, with albums that have no year last", () => {
    expect(titles(selectDated({ sortOrder: "year-asc" }))).toEqual([
      "Kind of Blue",
      "Blue Lines",
      "Mutations",
      "Mezzanine",
      "In Rainbows",
    ]);
    expect(titles(selectDated({ sortOrder: "year-desc" }))).toEqual([
      "Mutations",
      "Mezzanine",
      "Blue Lines",
      "Kind of Blue",
      "In Rainbows",
    ]);
  });

  it("shows only the albums from a decade, or those with no year", () => {
    expect(titles(selectDated({ decadeFilter: 1990 }))).toEqual([
      "Blue Lines",
      "Mezzanine",
      "Mutations",
    ]);
    expect(titles(selectDated({ decadeFilter: "none" }))).toEqual([
      "In Rainbows",
    ]);
  });

  it("lists the decades oldest first, then no year if some albums have none", () => {
    expect(listDecades(DATED)).toEqual([1950, 1990, "none"]);
    expect(listDecades(DATED.filter((album) => album.year))).toEqual([
      1950, 1990,
    ]);
    expect(listDecades(ALBUMS)).toEqual([]);
  });

  it("groups by decade, oldest or newest first as sorted, with no year last", () => {
    expect(
      sections(
        groupAlbums(
          selectDated({ sortOrder: "year-asc" }),
          "decade",
          "year-asc",
        ),
      ),
    ).toEqual([
      ["1950s", ["Kind of Blue"]],
      ["1990s", ["Blue Lines", "Mutations", "Mezzanine"]],
      ["No year", ["In Rainbows"]],
    ]);
    expect(
      headings(
        groupAlbums(
          selectDated({ sortOrder: "year-desc" }),
          "decade",
          "year-desc",
        ),
      ),
    ).toEqual(["1990s", "1950s", "No year"]);
  });
});
