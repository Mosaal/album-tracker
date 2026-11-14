import { describe, expect, it } from "vitest";

import { selectAlbums } from "./albumList";
import { Album } from "./types";

// Stored oldest first, in the order they were added.
const ALBUMS: Album[] = [
  { id: "1", title: "Kind of Blue", artist: "Miles Davis", status: "owned" },
  {
    id: "2",
    title: "Blue Lines",
    artist: "Massive Attack",
    status: "wishlisted",
  },
  { id: "3", title: "Mezzanine", artist: "Massive Attack", status: "owned" },
  { id: "4", title: "In Rainbows", artist: "Radiohead", status: "wishlisted" },
];

const titles = (albums: Album[]) => albums.map((album) => album.title);

const select = (options: Partial<Parameters<typeof selectAlbums>[1]>) =>
  selectAlbums(ALBUMS, {
    search: "",
    sortOrder: "title-asc",
    statusFilter: "all",
    ...options,
  });

describe("selectAlbums", () => {
  it("lists the most recently added albums first", () => {
    expect(titles(select({ sortOrder: "recent" }))).toEqual([
      "In Rainbows",
      "Mezzanine",
      "Blue Lines",
      "Kind of Blue",
    ]);
  });

  it("keeps the newest-first order within a search and status filter", () => {
    const visible = select({
      search: "massive",
      sortOrder: "recent",
      statusFilter: "all",
    });

    expect(titles(visible)).toEqual(["Mezzanine", "Blue Lines"]);
  });

  it("shows albums that match both the search, in any case, and the status", () => {
    const visible = select({ search: "MASSIVE", statusFilter: "owned" });

    expect(titles(visible)).toEqual(["Mezzanine"]);
  });

  it("leaves the stored order alone when sorting", () => {
    select({ sortOrder: "recent" });
    select({ sortOrder: "title-desc" });

    expect(titles(ALBUMS)).toEqual([
      "Kind of Blue",
      "Blue Lines",
      "Mezzanine",
      "In Rainbows",
    ]);
  });
});
