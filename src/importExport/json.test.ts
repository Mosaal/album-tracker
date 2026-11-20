import { describe, expect, it } from "vitest";

import { Album } from "../types";
import { createJson, InvalidJsonError, readJson } from "./json";

const KIND_OF_BLUE: Album = {
  id: "1",
  title: "Kind of Blue",
  artist: "Miles Davis",
  coverUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
  format: "vinyl",
  status: "owned",
  addedAt: "2026-01-01T09:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
};
const IN_RAINBOWS: Album = {
  id: "2",
  title: "In Rainbows",
  artist: "Radiohead",
  status: "wishlisted",
};

const exportOf = (albums: unknown[]) =>
  JSON.stringify({ format: "album-tracker", version: 1, albums });

describe("readJson", () => {
  it("reads back what createJson writes", () => {
    expect(readJson(createJson([KIND_OF_BLUE, IN_RAINBOWS]))).toEqual({
      albums: [KIND_OF_BLUE, IN_RAINBOWS],
      unreadable: 0,
    });
  });

  it.each([
    ["text that isn't JSON", "not json"],
    ["JSON from something else", JSON.stringify({ albums: [] })],
    [
      "an export without an album list",
      JSON.stringify({ format: "album-tracker" }),
    ],
  ])("rejects %s", (_, text) => {
    expect(() => readJson(text)).toThrow(InvalidJsonError);
  });

  it("skips entries it can't use and counts them", () => {
    const { albums, unreadable } = readJson(
      exportOf([
        IN_RAINBOWS,
        { ...IN_RAINBOWS, id: "3", title: "  " },
        { ...IN_RAINBOWS, id: "4", status: "borrowed" },
        "not an album",
      ]),
    );

    expect(albums).toEqual([IN_RAINBOWS]);
    expect(unreadable).toBe(3);
  });

  it("tidies up albums: trims text, drops bad cover URLs, adds missing ids and reads unknown formats as other", () => {
    const { albums } = readJson(
      exportOf([
        {
          title: " Kind of Blue ",
          artist: "Miles Davis",
          status: "owned",
          coverUrl: "javascript:alert(1)",
          format: "MiniDisc",
        },
      ]),
    );

    expect(albums).toEqual([
      {
        id: expect.any(String),
        title: "Kind of Blue",
        artist: "Miles Davis",
        format: "other",
        status: "owned",
      },
    ]);
  });

  it("reads when albums were added and changed in UTC, dropping dates it can't read", () => {
    const { albums } = readJson(
      exportOf([
        {
          ...IN_RAINBOWS,
          addedAt: "2026-01-01T09:00Z",
          updatedAt: "2026-03-01T10:00:00.5+01:00",
        },
        {
          ...IN_RAINBOWS,
          id: "3",
          addedAt: "yesterday",
          updatedAt: "2026-13-01T00:00:00Z",
        },
      ]),
    );

    expect(albums).toEqual([
      {
        ...IN_RAINBOWS,
        addedAt: "2026-01-01T09:00:00.000Z",
        updatedAt: "2026-03-01T09:00:00.500Z",
      },
      { ...IN_RAINBOWS, id: "3" },
    ]);
  });

  it("reads years and notes, trimming notes and dropping years it can't use", () => {
    const { albums } = readJson(
      exportOf([
        { ...IN_RAINBOWS, year: 2007, notes: "  Signed\n" },
        { ...IN_RAINBOWS, id: "3", year: 207, notes: " " },
        { ...IN_RAINBOWS, id: "4", year: 2007.5 },
      ]),
    );

    expect(albums).toEqual([
      { ...IN_RAINBOWS, year: 2007, notes: "Signed" },
      { ...IN_RAINBOWS, id: "3" },
      { ...IN_RAINBOWS, id: "4" },
    ]);
  });
});
