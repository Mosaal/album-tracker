import { describe, expect, it } from "vitest";

import { findAlbums, FoundAlbum, whyIncomplete } from "./musicLibrary";
import { Track } from "./musicTags";

const OK_COMPUTER = "b1392450-e666-3926-a536-22c65f834433";
const OTHER_RELEASE_GROUP = "0b6b4ba0-d36f-47bd-b4ea-6a5b91842d29";

/** A track in folders below the one chosen, like "Radiohead/OK Computer". */
const track = (folders: string, tags: Partial<Track> = {}): Track => ({
  folders: folders ? folders.split("/") : [],
  compilation: false,
  releaseTypes: [],
  ...tags,
});

const summarise = (albums: FoundAlbum[]) =>
  albums.map(({ artist, title, tracks }) => `${artist} - ${title} (${tracks})`);

describe("findAlbums", () => {
  it("puts an album's discs, and copies of its tracks, together", () => {
    const { albums, unplaced } = findAlbums([
      track("Pink Floyd/The Wall/CD1", {
        album: "The Wall (Disc 1)",
        artist: "Pink Floyd",
        disc: 1,
        track: 1,
        tracksOnDisc: 13,
      }),
      track("Pink Floyd/The Wall/Disc 2", {
        album: "The Wall [CD 2]",
        artist: "Pink Floyd",
        disc: 2,
        track: 1,
        tracksOnDisc: 13,
      }),
      // The same track again, as an MP3, spelled another way.
      track("MP3/Pink Floyd/The Wall", {
        album: "the wall - disc 1",
        artist: "pink floyd",
        disc: 1,
        track: 1,
        tracksOnDisc: 13,
      }),
    ]);

    expect(albums).toEqual([
      {
        key: "pink floyd\nthe wall",
        title: "The Wall",
        artist: "Pink Floyd",
        tracks: 2,
        totalTracks: 26,
        isSingle: false,
        isNamedFromFolder: false,
      },
    ]);
    expect(unplaced).toBe(0);
  });

  it("works out album artists for compilations and tracks with guests", () => {
    const { albums } = findAlbums([
      track("Compilations/Now 100", { album: "Now 100", artist: "Artist A" }),
      track("Compilations/Now 100", {
        album: "Now 100",
        artist: "Artist B",
        compilation: true,
      }),
      // No album artist or compilation tag, and no artist on most tracks.
      ...["Artist C", "Artist D", "Artist E feat. C"].map((artist) =>
        track("Mixes/Summer", { album: "Summer Mix", artist }),
      ),
      ...["Drake", "Drake feat. Rihanna", "Drake (ft. Future)"].map((artist) =>
        track("Drake/Views", { album: "Views", artist }),
      ),
      ...["Massive Attack", "Massive Attack & Tracey Thorn"].map((artist) =>
        track("Protection", {
          album: "Protection",
          albumArtist: "Massive Attack",
          artist,
        }),
      ),
    ]);

    expect(summarise(albums)).toEqual([
      "Drake - Views (3)",
      "Massive Attack - Protection (2)",
      "Various Artists - Now 100 (2)",
      "Various Artists - Summer Mix (3)",
    ]);
  });

  it("keeps apart the albums in a folder of loose tracks", () => {
    const { albums } = findAlbums([
      track("Downloads", { album: "OK Computer", artist: "Radiohead" }),
      track("Downloads", { album: "Kid A", artist: "Radiohead" }),
      track("Downloads", {
        album: "Blue Lines",
        artist: "Massive Attack feat. Shara Nelson",
      }),
      track("Downloads", {
        album: "Now 100",
        artist: "Artist A",
        compilation: true,
      }),
    ]);

    expect(summarise(albums)).toEqual([
      "Massive Attack - Blue Lines (1)",
      "Radiohead - Kid A (1)",
      "Radiohead - OK Computer (1)",
      "Various Artists - Now 100 (1)",
    ]);
  });

  it("prefers the year an album first came out, then the most common, then the earliest", () => {
    const yearOf = (years: Partial<Track>[]) =>
      findAlbums(
        years.map((tags) =>
          track("Radiohead/OK Computer", {
            album: "OK Computer",
            artist: "Radiohead",
            ...tags,
          }),
        ),
      ).albums[0].year;

    expect(yearOf([{ year: 2017, originalYear: 1997 }, { year: 2017 }])).toBe(
      1997,
    );
    expect(yearOf([{ year: 2009 }, { year: 1997 }, { year: 2009 }])).toBe(2009);
    expect(yearOf([{ year: 2009 }, { year: 1997 }])).toBe(1997);
    expect(yearOf([{}])).toBeUndefined();
  });

  it("goes by the MusicBrainz release group most of its tracks are from", () => {
    const { albums } = findAlbums(
      [OTHER_RELEASE_GROUP, OK_COMPUTER, OK_COMPUTER, undefined].map(
        (releaseGroupId) =>
          track("Radiohead/OK Computer", {
            album: "OK Computer",
            artist: "Radiohead",
            releaseGroupId,
          }),
      ),
    );

    expect(albums[0].releaseGroupId).toBe(OK_COMPUTER);
  });

  it("names albums without album tags after their folders", () => {
    const { albums, unplaced } = findAlbums([
      track("Massive Attack - Mezzanine (1998)"),
      track("Radiohead/1997 - OK Computer"),
      track("Prince/1999", { artist: "Prince" }),
      track("Pink Floyd/The Wall/CD1"),
      // Folders with no name to go by.
      track("Unknown Artist/Unknown Album"),
      track("Portishead"),
      // In the folder chosen, whose name is never used.
      track(""),
    ]);

    expect(
      albums.map(({ artist, title, year, isNamedFromFolder }) => ({
        artist,
        title,
        year,
        isNamedFromFolder,
      })),
    ).toEqual([
      {
        artist: "Massive Attack",
        title: "Mezzanine",
        year: 1998,
        isNamedFromFolder: true,
      },
      {
        artist: "Pink Floyd",
        title: "The Wall",
        year: undefined,
        isNamedFromFolder: true,
      },
      {
        artist: "Prince",
        title: "1999",
        year: undefined,
        isNamedFromFolder: true,
      },
      {
        artist: "Radiohead",
        title: "OK Computer",
        year: 1997,
        isNamedFromFolder: true,
      },
    ]);
    expect(unplaced).toBe(3);
  });

  it("notes singles, as MusicBrainz Picard tags them", () => {
    const { albums } = findAlbums([
      track("Radiohead/Creep", {
        album: "Creep",
        artist: "Radiohead",
        releaseTypes: ["single"],
      }),
    ]);

    expect(albums[0].isSingle).toBe(true);
  });
});

describe("whyIncomplete", () => {
  const album = (details: Partial<FoundAlbum>): FoundAlbum => ({
    key: "",
    title: "",
    artist: "",
    tracks: 10,
    isSingle: false,
    isNamedFromFolder: false,
    ...details,
  });

  it.each([
    [{ isSingle: true, tracks: 2 }, "Single"],
    [{ tracks: 1 }, "Only 1 track"],
    [{ tracks: 2 }, "Only 2 tracks"],
    [{ tracks: 3 }, undefined],
    [{ tracks: 5, totalTracks: 12 }, "5 of 12 tracks"],
    [{ tracks: 6, totalTracks: 12 }, undefined],
    // Its tags say it has two tracks, so it's all there.
    [{ tracks: 2, totalTracks: 2 }, undefined],
  ])("for %o is %s", (details, reason) => {
    expect(whyIncomplete(album(details))).toBe(reason);
  });
});
