import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCollectionStore } from "../albumStore";
import { useAlbums } from "./useAlbums";

const ALBUMS_KEY = "album-tracker:albums";
const DELETED_KEY = "album-tracker:deleted";
const saved = (key = ALBUMS_KEY) =>
  JSON.parse(localStorage.getItem(key) ?? "null");

const EARLIER = "2026-01-01T09:00:00.000Z";
const NOW = "2026-03-01T10:00:00.000Z";
const LATER = "2026-03-01T10:05:00.000Z";

const KIND_OF_BLUE = {
  title: "Kind of Blue",
  artist: "Miles Davis",
  coverUrl: "https://example.com/kind-of-blue.jpg",
  status: "owned" as const,
};

function renderAlbums(albums?: object[]) {
  if (albums) {
    localStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
  }
  const store = createCollectionStore();
  return renderHook(() => useAlbums(store)).result;
}

describe("useAlbums", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads saved albums", () => {
    const result = renderAlbums([{ ...KIND_OF_BLUE, id: "1" }]);

    expect(result.current.albums).toEqual([{ ...KIND_OF_BLUE, id: "1" }]);
  });

  it.each(["not json", '{"title":"not a list"}'])(
    "starts empty when the saved data is unreadable (%s), leaving it alone",
    (stored) => {
      localStorage.setItem(ALBUMS_KEY, stored);

      const result = renderAlbums();

      expect(result.current.albums).toEqual([]);
      expect(localStorage.getItem(ALBUMS_KEY)).toBe(stored);
    },
  );

  it("adds an album with a new id, noting when it was added", () => {
    const result = renderAlbums();

    act(() => result.current.addAlbum(KIND_OF_BLUE));

    expect(result.current.albums).toEqual([
      { ...KIND_OF_BLUE, id: expect.any(String), addedAt: NOW, updatedAt: NOW },
    ]);
    expect(saved()).toEqual(result.current.albums);
  });

  it("replaces every field on update, so a removed cover stays removed", () => {
    const result = renderAlbums([
      { ...KIND_OF_BLUE, id: "1", addedAt: EARLIER, updatedAt: EARLIER },
    ]);

    act(() =>
      result.current.updateAlbum("1", {
        title: "Kind of Blue (Legacy Edition)",
        artist: "Miles Davis",
        status: "owned",
      }),
    );

    expect(saved()).toEqual([
      {
        id: "1",
        title: "Kind of Blue (Legacy Edition)",
        artist: "Miles Davis",
        status: "owned",
        addedAt: EARLIER,
        updatedAt: NOW,
      },
    ]);
  });

  it("leaves an album alone when an update changes nothing", () => {
    const album = { ...KIND_OF_BLUE, id: "1", updatedAt: EARLIER };
    const result = renderAlbums([album]);

    act(() => result.current.updateAlbum("1", KIND_OF_BLUE));

    expect(saved()).toEqual([album]);
  });

  it("changes the status of the albums given, noting which ones changed", () => {
    const result = renderAlbums([
      { ...KIND_OF_BLUE, id: "1" },
      { ...KIND_OF_BLUE, id: "2" },
      { ...KIND_OF_BLUE, id: "3", status: "wishlisted" },
    ]);

    act(() => result.current.setAlbumsStatus(["1", "3"], "wishlisted"));

    expect(saved()).toEqual([
      { ...KIND_OF_BLUE, id: "1", status: "wishlisted", updatedAt: NOW },
      { ...KIND_OF_BLUE, id: "2" },
      { ...KIND_OF_BLUE, id: "3", status: "wishlisted" },
    ]);
  });

  it("never notes a change as older than the newest one it has", () => {
    // From a device whose clock ran ahead.
    const result = renderAlbums([
      { ...KIND_OF_BLUE, id: "1", updatedAt: "2026-06-01T00:00:00.000Z" },
    ]);

    act(() => result.current.setAlbumsStatus(["1"], "wishlisted"));

    expect(saved()[0].updatedAt).toBe("2026-06-01T00:00:00.001Z");
  });

  it("remembers deleted albums, and putting them back where they were forgets them", () => {
    const albums = ["1", "2", "3", "4"].map((id) => ({
      ...KIND_OF_BLUE,
      id,
      title: `Album ${id}`,
    }));
    const result = renderAlbums(albums);

    let restore = () => {};
    act(() => {
      restore = result.current.deleteAlbums(["2", "4"]);
    });
    expect(saved()).toEqual([albums[0], albums[2]]);
    expect(saved(DELETED_KEY)).toEqual([
      { id: "2", deletedAt: NOW },
      { id: "4", deletedAt: NOW },
    ]);

    vi.setSystemTime(new Date(LATER));
    act(() => restore());
    act(() => restore());
    expect(saved()).toEqual([
      albums[0],
      { ...albums[1], updatedAt: LATER },
      albums[2],
      { ...albums[3], updatedAt: LATER },
    ]);
    expect(saved(DELETED_KEY)).toEqual([]);
  });

  it("notes when imported albums were added, keeping the date from the file", () => {
    localStorage.setItem(
      DELETED_KEY,
      JSON.stringify([{ id: "2", deletedAt: EARLIER }]),
    );
    const result = renderAlbums([{ ...KIND_OF_BLUE, id: "1" }]);

    let summary;
    act(() => {
      summary = result.current.importAlbums([
        { ...KIND_OF_BLUE, id: "1" },
        { ...KIND_OF_BLUE, id: "2", title: "Milestones", addedAt: EARLIER },
        { ...KIND_OF_BLUE, id: "3", title: "Sketches of Spain" },
      ]);
    });

    expect(summary).toEqual({ added: 2, skipped: 1 });
    expect(saved()).toEqual([
      { ...KIND_OF_BLUE, id: "1" },
      {
        ...KIND_OF_BLUE,
        id: "2",
        title: "Milestones",
        addedAt: EARLIER,
        updatedAt: NOW,
      },
      {
        ...KIND_OF_BLUE,
        id: "3",
        title: "Sketches of Spain",
        addedAt: NOW,
        updatedAt: NOW,
      },
    ]);
    // Album 2 is back, so its deletion no longer counts.
    expect(saved(DELETED_KEY)).toEqual([]);
  });

  it("picks up albums saved by another tab", () => {
    const result = renderAlbums([{ ...KIND_OF_BLUE, id: "1" }]);

    localStorage.setItem(
      ALBUMS_KEY,
      JSON.stringify([
        { ...KIND_OF_BLUE, id: "1" },
        { ...KIND_OF_BLUE, id: "2", title: "Milestones" },
      ]),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: ALBUMS_KEY }));
    });

    expect(result.current.albums.map((album) => album.title)).toEqual([
      "Kind of Blue",
      "Milestones",
    ]);
  });
});
