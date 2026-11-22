import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCollectionStore } from "../albums/albumStore";
import { CoverQuery } from "../api/coverArt";
import { MusicBrainzError } from "../api/musicBrainz";
import { Album } from "../types";
import {
  CoverFinderState,
  createCoverFinder,
  describeCoverSearch,
  LOOKUP_EVERY_MS,
} from "./coverFinder";

const NOW = "2026-03-01T10:00:00.000Z";

const album = (id: string, details: Partial<Album> = {}): Album => ({
  id,
  title: `Album ${id}`,
  artist: "Artist",
  status: "owned",
  ...details,
});

const coverOf = (title: string) => `https://example.com/${title}.jpg`;

function setUp(albums: Album[], findCover = vi.fn()) {
  localStorage.setItem("album-tracker:albums", JSON.stringify(albums));
  const store = createCollectionStore();
  const finder = createCoverFinder({ store, findCover });
  const ended = vi.fn();
  finder.onEnd(ended);
  const covers = () =>
    Object.fromEntries(
      store.get().albums.map(({ id, coverUrl }) => [id, coverUrl]),
    );
  return { store, finder, ended, covers };
}

/** Finds a cover for every album, but for those named here. */
const findAllBut =
  (...missing: string[]) =>
  async ({ title }: CoverQuery) =>
    missing.includes(title) ? undefined : coverOf(title);

describe("createCoverFinder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("looks up albums without a cover, about a second apart, and saves those it finds", async () => {
    const findCover = vi.fn(findAllBut("Album 4"));
    const { finder, ended, covers, store } = setUp(
      [
        album("1"),
        album("2", { coverUrl: "https://example.com/mine.jpg" }),
        album("3", { year: 1959 }),
        album("4"),
      ],
      findCover,
    );

    finder.find(["1", "2", "3", "4"]);
    expect(finder.getState()).toEqual({
      isFinding: true,
      isWaiting: false,
      done: 0,
      total: 4,
      found: 0,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(findCover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LOOKUP_EVERY_MS - 1);
    expect(findCover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(findCover).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(LOOKUP_EVERY_MS);

    // Album 2 already had a cover, so it wasn't looked up.
    expect(findCover.mock.calls.map(([query]) => query)).toEqual([
      { title: "Album 1", artist: "Artist", year: undefined },
      { title: "Album 3", artist: "Artist", year: 1959 },
      { title: "Album 4", artist: "Artist", year: undefined },
    ]);
    const state = {
      isFinding: false,
      isWaiting: false,
      done: 4,
      total: 4,
      found: 2,
    };
    expect(finder.getState()).toEqual(state);
    expect(ended).toHaveBeenCalledExactlyOnceWith("done", state);
    expect(covers()).toEqual({
      1: coverOf("Album 1"),
      2: "https://example.com/mine.jpg",
      3: coverOf("Album 3"),
      4: undefined,
    });
    // Saved, and stamped, at the end of the run.
    const savedAt = new Date(
      Date.parse(NOW) + 2 * LOOKUP_EVERY_MS,
    ).toISOString();
    expect(store.get().albums.map(({ updatedAt }) => updatedAt)).toEqual([
      savedAt,
      undefined,
      savedAt,
      undefined,
    ]);
  });

  it("saves covers as it goes: 20 at a time, or after 30 seconds", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => String(index + 1));
    // Only the first 20, and album 30, have covers.
    const findCover = vi.fn(async ({ title }: CoverQuery) =>
      Number(title.split(" ")[1]) <= 20 || title === "Album 30"
        ? coverOf(title)
        : undefined,
    );
    const { finder, covers } = setUp(
      ids.map((id) => album(id)),
      findCover,
    );
    const saved = () => Object.values(covers()).filter(Boolean).length;

    finder.find(ids);
    // The 20th cover is found after 19 waits.
    await vi.advanceTimersByTimeAsync(19 * LOOKUP_EVERY_MS - 1);
    expect(saved()).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved()).toBe(20);
    // Album 30's cover waits until 30 seconds after the last save.
    await vi.advanceTimersByTimeAsync(10 * LOOKUP_EVERY_MS);
    expect(saved()).toBe(20);
    await vi.advanceTimersByTimeAsync(18 * LOOKUP_EVERY_MS);
    expect(saved()).toBe(21);
  });

  it("leaves a cover set while it was looking", async () => {
    const { finder, store, covers } = setUp(
      [album("1"), album("2")],
      vi.fn(findAllBut()),
    );

    finder.find(["1", "2"]);
    await vi.advanceTimersByTimeAsync(0);
    store.update((current) => ({
      ...current,
      albums: current.albums.map((album) =>
        album.id === "1"
          ? { ...album, coverUrl: "https://example.com/mine.jpg" }
          : album,
      ),
    }));
    await vi.advanceTimersByTimeAsync(LOOKUP_EVERY_MS);

    expect(covers()).toEqual({
      1: "https://example.com/mine.jpg",
      2: coverOf("Album 2"),
    });
  });

  it("stops when asked, keeping the covers found", async () => {
    const findCover = vi.fn(findAllBut());
    const { finder, ended, covers } = setUp(
      [album("1"), album("2"), album("3")],
      findCover,
    );

    finder.find(["1", "2", "3"]);
    await vi.advanceTimersByTimeAsync(0);
    finder.stop();
    await vi.advanceTimersByTimeAsync(10 * LOOKUP_EVERY_MS);

    expect(findCover).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledExactlyOnceWith("stopped", {
      isFinding: false,
      isWaiting: false,
      done: 1,
      total: 3,
      found: 1,
    });
    expect(covers()).toEqual({
      1: coverOf("Album 1"),
      2: undefined,
      3: undefined,
    });
  });

  it("waits for MusicBrainz while it's busy, then carries on", async () => {
    const busy = new MusicBrainzError("unavailable", "MusicBrainz failed");
    const findCover = vi
      .fn()
      .mockRejectedValueOnce(busy)
      .mockRejectedValueOnce(busy)
      .mockResolvedValueOnce(coverOf("Album 1"));
    const { finder, covers } = setUp([album("1")], findCover);

    finder.find(["1"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(finder.getState()).toMatchObject({ isWaiting: true, done: 0 });
    // Tries again after 30 seconds, then after a minute.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(findCover).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(findCover).toHaveBeenCalledTimes(3);
    expect(finder.getState()).toMatchObject({
      isFinding: false,
      isWaiting: false,
      done: 1,
      found: 1,
    });
    expect(covers()).toEqual({ 1: coverOf("Album 1") });
  });

  it("stops when MusicBrainz stays busy, keeping the covers found", async () => {
    const findCover = vi
      .fn()
      .mockResolvedValueOnce(coverOf("Album 1"))
      .mockRejectedValue(
        new MusicBrainzError("unavailable", "MusicBrainz failed with 503"),
      );
    const { finder, ended, covers } = setUp(
      [album("1"), album("2"), album("3")],
      findCover,
    );

    finder.find(["1", "2", "3"]);
    // Album 2, then three tries after waiting 30 seconds, 1 and 2 minutes.
    await vi.advanceTimersByTimeAsync(LOOKUP_EVERY_MS + 210_000 - 1);
    expect(ended).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(findCover).toHaveBeenCalledTimes(5);
    expect(ended).toHaveBeenCalledExactlyOnceWith(
      "unavailable",
      expect.objectContaining({ isFinding: false, found: 1 }),
    );
    expect(covers()).toEqual({
      1: coverOf("Album 1"),
      2: undefined,
      3: undefined,
    });
  });

  it("stops straight away when the browser is offline", async () => {
    const findCover = vi
      .fn()
      .mockRejectedValue(
        new MusicBrainzError("offline", "The browser is offline"),
      );
    const { finder, ended } = setUp([album("1"), album("2")], findCover);

    finder.find(["1", "2"]);
    await vi.advanceTimersByTimeAsync(0);

    expect(findCover).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledWith("offline", expect.anything());
  });

  it("adds albums to a run that's going, looking each up once", async () => {
    const findCover = vi.fn(findAllBut());
    const { finder } = setUp([album("1"), album("2")], findCover);

    finder.find(["1"]);
    finder.find(["1", "2", "2"]);
    expect(finder.getState().total).toBe(2);
    await vi.advanceTimersByTimeAsync(10 * LOOKUP_EVERY_MS);

    expect(findCover).toHaveBeenCalledTimes(2);
    expect(finder.getState()).toMatchObject({ done: 2, found: 2 });
  });
});

describe("describeCoverSearch", () => {
  const state = (found: number, total: number): CoverFinderState => ({
    isFinding: false,
    isWaiting: false,
    done: total,
    total,
    found,
  });

  it.each([
    ["done", state(9, 12), "Found covers for 9 of 12 albums."],
    ["done", state(12, 12), "Found covers for all 12 albums."],
    ["done", state(1, 1), "Found the album's cover."],
    ["done", state(0, 12), "Couldn't find covers for the 12 albums."],
    ["done", state(0, 1), "Couldn't find a cover for the album."],
    ["stopped", state(3, 12), "Stopped finding covers, after finding 3."],
    ["stopped", state(0, 12), "Stopped finding covers."],
    [
      "offline",
      state(3, 12),
      "Stopped finding covers, as the browser is offline. Find missing covers, in the ⋯ menu, carries on later.",
    ],
  ] as const)("says how a run that ended %s went", (end, result, message) => {
    expect(describeCoverSearch(end, result)).toBe(message);
  });
});
