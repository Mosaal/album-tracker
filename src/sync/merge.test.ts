import { describe, expect, it } from "vitest";

import { Album, Collection, DeletedAlbum } from "../types";
import { mergeCollections } from "./merge";

const MARCH_1 = "2026-03-01T10:00:00.000Z";
const MARCH_2 = "2026-03-02T10:00:00.000Z";
const MARCH_3 = "2026-03-03T10:00:00.000Z";

const album = (id: string, title: string, updatedAt?: string): Album => ({
  id,
  title,
  artist: "Massive Attack",
  status: "owned",
  ...(updatedAt ? { updatedAt } : {}),
});

const collection = (
  albums: Album[],
  deleted: DeletedAlbum[] = [],
): Collection => ({ albums, deleted });

const titles = ({ albums }: Collection) => albums.map((album) => album.title);

describe("mergeCollections", () => {
  it("keeps albums added on either side, the repository's first", () => {
    const merged = mergeCollections(
      collection([album("1", "Blue Lines"), album("3", "Mezzanine")]),
      collection([album("1", "Blue Lines"), album("2", "Protection")]),
    );

    expect(titles(merged)).toEqual(["Blue Lines", "Protection", "Mezzanine"]);
  });

  it("keeps this device's copy of an album the repository has unchanged", () => {
    const local = collection([
      album("1", "Blue Lines", MARCH_1),
      album("2", "Protection", MARCH_1),
    ]);
    const remote = collection([
      album("1", "Blue Lines", MARCH_1),
      album("2", "Protection (Remastered)", MARCH_2),
    ]);
    const merged = mergeCollections(local, remote);

    // The same object, so the album isn't drawn again.
    expect(merged.albums[0]).toBe(local.albums[0]);
    expect(merged.albums[1]).toBe(remote.albums[1]);
  });

  it("keeps the most recent change to an album, from either side", () => {
    const local = collection([
      album("1", "Blue Lines (Remastered)", MARCH_2),
      album("2", "Protection", MARCH_1),
    ]);
    const remote = collection([
      album("1", "Blue Lines", MARCH_1),
      album("2", "Protection (Deluxe)", MARCH_3),
    ]);

    expect(titles(mergeCollections(local, remote))).toEqual([
      "Blue Lines (Remastered)",
      "Protection (Deluxe)",
    ]);
  });

  it("prefers the repository's copy when both changed at the same time, or have no dates", () => {
    const merged = mergeCollections(
      collection([album("1", "Mine", MARCH_1), album("2", "Mine too")]),
      collection([album("1", "Theirs", MARCH_1), album("2", "Theirs too")]),
    );

    expect(titles(merged)).toEqual(["Theirs", "Theirs too"]);
  });

  it("counts an album without a date as older than any change", () => {
    const merged = mergeCollections(
      collection([album("1", "Blue Lines (Remastered)", MARCH_1)]),
      collection([album("1", "Blue Lines")]),
    );

    expect(titles(merged)).toEqual(["Blue Lines (Remastered)"]);
  });

  it("deletes an album everywhere when the deletion came after its last change", () => {
    const deletion = { id: "1", deletedAt: MARCH_2 };
    const local = collection([album("2", "Protection")], [deletion]);
    const remote = collection([
      album("1", "Blue Lines", MARCH_1),
      album("2", "Protection"),
    ]);

    expect(mergeCollections(local, remote)).toEqual(
      collection([album("2", "Protection")], [deletion]),
    );
    // And the other way round, for the device that still has it.
    expect(mergeCollections(remote, local)).toEqual(
      collection([album("2", "Protection")], [deletion]),
    );
  });

  it("deletes an album that has no date at all", () => {
    const merged = mergeCollections(
      collection([album("1", "Blue Lines")]),
      collection([], [{ id: "1", deletedAt: MARCH_1 }]),
    );

    expect(merged.albums).toEqual([]);
  });

  it("keeps an album changed after it was deleted, forgetting the deletion", () => {
    // Say it was put back with Undo after another device saw the deletion.
    const merged = mergeCollections(
      collection([album("1", "Blue Lines", MARCH_3)]),
      collection([], [{ id: "1", deletedAt: MARCH_2 }]),
    );

    expect(merged).toEqual(collection([album("1", "Blue Lines", MARCH_3)]));
  });

  it("keeps the latest time for an album deleted on both sides", () => {
    const merged = mergeCollections(
      collection([], [{ id: "1", deletedAt: MARCH_1 }]),
      collection([], [{ id: "1", deletedAt: MARCH_2 }]),
    );

    expect(merged.deleted).toEqual([{ id: "1", deletedAt: MARCH_2 }]);
  });

  it("keeps one copy of an album listed twice", () => {
    const merged = mergeCollections(
      collection([]),
      collection([
        album("1", "Blue Lines", MARCH_1),
        album("1", "Blue Lines (Newer)", MARCH_2),
      ]),
    );

    expect(titles(merged)).toEqual(["Blue Lines (Newer)"]);
  });

  it("brings two devices to the same collection, which merging again doesn't change", () => {
    const phone = collection(
      [album("1", "Blue Lines", MARCH_2), album("3", "Mezzanine", MARCH_1)],
      [{ id: "2", deletedAt: MARCH_2 }],
    );
    const laptop = collection([
      album("1", "Blue Lines (Remastered)", MARCH_1),
      album("2", "Protection", MARCH_1),
      album("4", "Heligoland", MARCH_3),
    ]);

    // The laptop saves first; then the phone merges and saves; then the laptop catches up.
    const afterPhone = mergeCollections(phone, laptop);
    const afterLaptop = mergeCollections(laptop, afterPhone);

    expect(afterLaptop).toEqual(afterPhone);
    expect(titles(afterPhone)).toEqual([
      "Blue Lines",
      "Heligoland",
      "Mezzanine",
    ]);
    expect(mergeCollections(afterPhone, afterPhone)).toEqual(afterPhone);
  });
});
