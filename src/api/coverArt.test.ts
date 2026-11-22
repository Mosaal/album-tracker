import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  findCover,
  matchCovers,
  searchCovers,
  withoutEdition,
} from "./coverArt";

const fetchMock = vi.fn<typeof fetch>();

const found = (groups: object[]) =>
  new Response(JSON.stringify({ "release-groups": groups }));
const busy = (status = 503) => new Response("", { status });
const dropped = () => new TypeError("Failed to fetch");

const searchedQuery = (call = 0) =>
  new URL(String(fetchMock.mock.calls[call][0])).searchParams.get("query");

describe("searchCovers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("searches by title and artist, escaping query syntax", async () => {
    fetchMock.mockResolvedValue(found([]));

    await searchCovers("Love AND Theft", "AC/DC");

    expect(searchedQuery()).toBe(
      "releasegroup:(love and theft) AND artist:(ac\\/dc)",
    );
  });

  it("searches by title alone when there's no artist", async () => {
    fetchMock.mockResolvedValue(found([]));

    await searchCovers("Vespertine", " ");

    expect(searchedQuery()).toBe("releasegroup:(vespertine)");
  });

  it("turns release groups into cover options", async () => {
    fetchMock.mockResolvedValue(
      found([
        {
          id: "rg-1",
          title: "Kind of Blue",
          "first-release-date": "1959-08-17",
          "artist-credit": [{ name: "Miles Davis" }],
        },
        {
          id: "rg-2",
          title: "Kind of Blue / Blue Train",
          "first-release-date": "",
          "artist-credit": [
            { name: "Miles Davis", joinphrase: " / " },
            { name: "John Coltrane" },
          ],
        },
      ]),
    );

    await expect(searchCovers("Kind of Blue", "")).resolves.toEqual([
      {
        id: "rg-1",
        title: "Kind of Blue",
        artist: "Miles Davis",
        year: "1959",
        thumbnailUrl:
          "https://coverartarchive.org/release-group/rg-1/front-250",
        imageUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
      },
      {
        id: "rg-2",
        title: "Kind of Blue / Blue Train",
        artist: "Miles Davis / John Coltrane",
        year: undefined,
        thumbnailUrl:
          "https://coverartarchive.org/release-group/rg-2/front-250",
        imageUrl: "https://coverartarchive.org/release-group/rg-2/front-500",
      },
    ]);
  });

  it("retries while MusicBrainz is busy or the connection drops", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(busy())
      .mockRejectedValueOnce(dropped())
      .mockResolvedValueOnce(busy(504))
      .mockResolvedValueOnce(found([]));

    const search = searchCovers("In Rainbows", "Radiohead");
    await vi.advanceTimersByTimeAsync(7000);

    await expect(search).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("gives up once the retries run out", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(busy());

    const search = expect(
      searchCovers("In Rainbows", "Radiohead"),
    ).rejects.toMatchObject({ reason: "unavailable" });
    await vi.advanceTimersByTimeAsync(7000);

    await search;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("doesn't retry while the browser is offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fetchMock.mockRejectedValue(dropped());

    await expect(
      searchCovers("In Rainbows", "Radiohead"),
    ).rejects.toMatchObject({ reason: "offline" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once the search is cancelled", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(busy());
    const controller = new AbortController();

    const search = expect(
      searchCovers("In Rainbows", "Radiohead", controller.signal),
    ).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(500);
    controller.abort();
    await search;
    await vi.advanceTimersByTimeAsync(7000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("withoutEdition", () => {
  it.each([
    ["OK Computer (Remastered)", "OK Computer"],
    ["Abbey Road (Super Deluxe Edition)", "Abbey Road"],
    ["Rumours - 2004 Remaster", "Rumours"],
    ["Back in Black (2003 Remaster) [Deluxe]", "Back in Black"],
    ["Hello - EP", "Hello"],
    // Not editions.
    ["Version 2.0", "Version 2.0"],
    ["(What's the Story) Morning Glory?", "(What's the Story) Morning Glory?"],
    ["Live - At the BBC", "Live - At the BBC"],
  ])("makes %s %s", (title, base) => {
    expect(withoutEdition(title)).toBe(base);
  });
});

const result = (id: string, title: string, artist: string, year?: string) => ({
  id,
  title,
  artist,
  year,
  thumbnailUrl: `https://coverartarchive.org/release-group/${id}/front-250`,
  imageUrl: `https://coverartarchive.org/release-group/${id}/front-500`,
});

describe("matchCovers", () => {
  it("ignores accents, case, punctuation, the edition and a leading The", () => {
    const matches = matchCovers(
      {
        title: "Sgt Peppers Lonely Hearts Club Band (Remastered)",
        artist: "Beatles",
      },
      [
        result("rg-1", "Sgt. Pepper’s Lonely Hearts Club Band", "The Beatles"),
        result(
          "rg-2",
          "Sgt. Pepper's Lonely Hearts Club Band",
          "The Beatles Revival Band",
        ),
      ],
    );

    expect(matches.map(({ id }) => id)).toEqual(["rg-1"]);
  });

  it("puts the year closest to the album's first, keeping the search's order otherwise", () => {
    const results = [
      result("reissue", "Weezer", "Weezer", "2008"),
      result("no-year", "Weezer", "Weezer"),
      result("blue", "Weezer", "Weezer", "1994"),
      result("green", "Weezer", "Weezer", "2001"),
    ];

    expect(
      matchCovers(
        { title: "Weezer", artist: "Weezer", year: 1994 },
        results,
      ).map(({ id }) => id),
    ).toEqual(["blue", "green", "reissue", "no-year"]);
    expect(
      matchCovers({ title: "Weezer", artist: "Weezer" }, results).map(
        ({ id }) => id,
      ),
    ).toEqual(["reissue", "no-year", "blue", "green"]);
  });
});

describe("findCover", () => {
  // The Cover Art Archive redirects to covers it has, and 404s otherwise.
  const archive = (covers: string[]) => (url: string) =>
    new Response(null, {
      status: covers.some((id) => url.includes(`/${id}/`)) ? 200 : 404,
    });

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("takes the cover of the same album, from the closest year, that the archive has", async () => {
    fetchMock.mockImplementation(async (input, init) =>
      init?.method === "HEAD"
        ? archive(["later"])(String(input))
        : found([
            {
              id: "other",
              title: "Kind of Blue / Blue Train",
              "artist-credit": [{ name: "Miles Davis" }],
            },
            {
              id: "later",
              title: "Kind of Blue",
              "first-release-date": "1997",
              "artist-credit": [{ name: "Miles Davis" }],
            },
            {
              id: "first",
              title: "Kind of Blue",
              "first-release-date": "1959-08-17",
              "artist-credit": [{ name: "Miles Davis" }],
            },
          ]),
    );

    await expect(
      findCover({
        title: "Kind of Blue (Legacy Edition)",
        artist: "Miles Davis",
        year: 1959,
      }),
    ).resolves.toBe(
      "https://coverartarchive.org/release-group/later/front-500",
    );
    // Searched for the album, not the edition.
    expect(searchedQuery()).toBe(
      "releasegroup:(kind of blue) AND artist:(miles davis)",
    );
    // The closest year first, which had no cover.
    expect(fetchMock.mock.calls.slice(1).map(([url]) => url)).toEqual([
      "https://coverartarchive.org/release-group/first/front-500",
      "https://coverartarchive.org/release-group/later/front-500",
    ]);
  });

  it("finds nothing when no result is the same album", async () => {
    fetchMock.mockResolvedValue(
      found([
        {
          id: "rg-1",
          title: "Kind of Blue",
          "artist-credit": [{ name: "Miles Davis Quintet" }],
        },
      ]),
    );

    await expect(
      findCover({ title: "Kind of Blue", artist: "Miles Davis" }),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails when the archive does", async () => {
    fetchMock.mockImplementation(async (_, init) =>
      init?.method === "HEAD"
        ? busy(502)
        : found([
            {
              id: "rg-1",
              title: "Kind of Blue",
              "artist-credit": [{ name: "Miles Davis" }],
            },
          ]),
    );

    await expect(
      findCover({ title: "Kind of Blue", artist: "Miles Davis" }),
    ).rejects.toMatchObject({ reason: "unavailable" });
  });
});
