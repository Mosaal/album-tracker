import { describe, expect, it } from "vitest";

import { createJson, InvalidJsonError, readJson } from "./json";
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

  it("tidies up albums: trims text, drops bad cover URLs and adds missing ids", () => {
    const { albums } = readJson(
      exportOf([
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
