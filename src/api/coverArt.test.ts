import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchCovers } from "./coverArt";

const fetchMock = vi.fn<typeof fetch>();

const found = (groups: object[]) =>
  new Response(JSON.stringify({ "release-groups": groups }));
const busy = () => new Response("", { status: 503 });

const searchedQuery = (call = 0) =>
  new URL(String(fetchMock.mock.calls[call][0])).searchParams.get("query");

describe("searchCovers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
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

  it("retries while MusicBrainz is busy", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(busy())
      .mockResolvedValueOnce(found([]));

    const search = searchCovers("In Rainbows", "Radiohead");
    await vi.advanceTimersByTimeAsync(3000);

    await expect(search).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up once the retries run out", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(busy());

    const search = expect(
      searchCovers("In Rainbows", "Radiohead"),
    ).rejects.toThrow("503");
    await vi.advanceTimersByTimeAsync(7000);

    await search;
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
