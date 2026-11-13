import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useAlbums } from "./useAlbums";

const STORAGE_KEY = "album-tracker:albums";
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");

const KIND_OF_BLUE = {
  title: "Kind of Blue",
  artist: "Miles Davis",
  coverUrl: "https://example.com/kind-of-blue.jpg",
  status: "owned" as const,
};

describe("useAlbums", () => {
  it("loads saved albums", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...KIND_OF_BLUE, id: "1" }]),
    );

    const { result } = renderHook(() => useAlbums());

    expect(result.current.albums).toEqual([{ ...KIND_OF_BLUE, id: "1" }]);
  });

  it.each(["not json", '{"title":"not a list"}'])(
    "starts empty when the saved data is unreadable (%s)",
    (stored) => {
      localStorage.setItem(STORAGE_KEY, stored);

      const { result } = renderHook(() => useAlbums());

      expect(result.current.albums).toEqual([]);
    },
  );

  it("adds an album with a new id and saves it", () => {
    const { result } = renderHook(() => useAlbums());

    act(() => result.current.addAlbum(KIND_OF_BLUE));

    expect(result.current.albums).toEqual([
      { ...KIND_OF_BLUE, id: expect.any(String) },
    ]);
    expect(saved()).toEqual(result.current.albums);
  });

  it("replaces every field on update, so a removed cover stays removed", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...KIND_OF_BLUE, id: "1" }]),
    );
    const { result } = renderHook(() => useAlbums());

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
      },
    ]);
  });

  it("changes only the status when toggling ownership", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...KIND_OF_BLUE, id: "1" }]),
    );
    const { result } = renderHook(() => useAlbums());

    act(() => result.current.setAlbumStatus("1", "wishlisted"));

    expect(saved()).toEqual([
      { ...KIND_OF_BLUE, id: "1", status: "wishlisted" },
    ]);
  });

  it("deletes an album", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { ...KIND_OF_BLUE, id: "1" },
        { ...KIND_OF_BLUE, id: "2", title: "Milestones" },
      ]),
    );
    const { result } = renderHook(() => useAlbums());

    act(() => result.current.deleteAlbum("1"));

    expect(saved()).toEqual([
      { ...KIND_OF_BLUE, id: "2", title: "Milestones" },
    ]);
  });
});
