import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lookUpBarcode, toAlbumFormat, toBarcode } from "./barcodeLookup";

const fetchMock = vi.fn<typeof fetch>();

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status });

const OK_COMPUTER = {
  title: "OK Computer",
  "artist-credit": [{ name: "Radiohead" }],
  "release-group": { id: "rg-1", title: "OK Computer" },
  media: [{ format: "CD" }],
};

const requested = (call: number) =>
  new URL(String(fetchMock.mock.calls[call][0]));

describe("lookUpBarcode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("finds the album, with the year its release group first came out", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ releases: [OK_COMPUTER] }))
      .mockResolvedValueOnce(json({ "first-release-date": "1997-05-21" }));

    await expect(lookUpBarcode("724385522925")).resolves.toEqual({
      title: "OK Computer",
      artist: "Radiohead",
      year: 1997,
      format: "cd",
      coverUrl: "https://coverartarchive.org/release-group/rg-1/front-500",
    });
    // Looked up as a UPC and as the EAN-13 it's also written as.
    expect(requested(0).pathname).toBe("/ws/2/release/");
    expect(requested(0).searchParams.get("query")).toBe(
      "barcode:724385522925 OR barcode:0724385522925",
    );
    expect(requested(1).pathname).toBe("/ws/2/release-group/rg-1");
  });

  it("finds nothing for a barcode MusicBrainz doesn't have", async () => {
    fetchMock.mockResolvedValueOnce(json({ releases: [] }));

    await expect(lookUpBarcode("5012345678900")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still finds the album when its year can't be looked up", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ releases: [OK_COMPUTER] }))
      .mockResolvedValueOnce(json({}, 500));

    await expect(lookUpBarcode("0724385522925")).resolves.toMatchObject({
      title: "OK Computer",
      year: undefined,
    });
    expect(requested(0).searchParams.get("query")).toBe(
      "barcode:0724385522925 OR barcode:724385522925",
    );
  });
});

describe("toAlbumFormat", () => {
  it.each([
    ['12" Vinyl', "vinyl"],
    ["Enhanced CD", "cd"],
    ["Hybrid SACD", "cd"],
    ["Cassette", "cassette"],
    ["Digital Media", "digital"],
    ["DVD", "other"],
    [null, undefined],
  ])("reads the medium %j as %s", (medium, expected) => {
    expect(toAlbumFormat(medium)).toBe(expected);
  });
});

describe("toBarcode", () => {
  it.each([
    [" 0 724385 52292 5 ", "0724385522925"],
    ["9-780141-036144", "9780141036144"],
    ["1234567", undefined],
    ["ABC123456789", undefined],
  ])("reads %j as %s", (text, expected) => {
    expect(toBarcode(text)).toBe(expected);
  });
});
