import { Album, AlbumSortOrder, AlbumStatusFilter } from "./types";

const SORT_COMPARATORS: Record<
  Exclude<AlbumSortOrder, "recent">,
  (a: Album, b: Album) => number
> = {
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "title-desc": (a, b) => b.title.localeCompare(a.title),
  "artist-asc": (a, b) => a.artist.localeCompare(b.artist),
  "artist-desc": (a, b) => b.artist.localeCompare(a.artist),
};

export type StatusCounts = Record<AlbumStatusFilter, number>;

interface AlbumListOptions {
  search: string;
  sortOrder: AlbumSortOrder;
  statusFilter: AlbumStatusFilter;
}

/**
 * Picks and orders the albums to show. The counts cover every album that
 * matches the search, so each status option says how many it would show.
 */
export function selectAlbums(
  albums: Album[],
  { search, sortOrder, statusFilter }: AlbumListOptions,
) {
  const query = search.trim().toLowerCase();
  const matching = albums.filter(
    (album) =>
      query === "" ||
      album.title.toLowerCase().includes(query) ||
      album.artist.toLowerCase().includes(query),
  );
  const visible = matching.filter(
    (album) => statusFilter === "all" || album.status === statusFilter,
  );
  const counts: StatusCounts = {
    all: matching.length,
    owned: matching.filter((album) => album.status === "owned").length,
    wishlisted: matching.filter((album) => album.status === "wishlisted")
      .length,
  };

  return {
    // Albums are stored in the order they were added, so the newest is last.
    visible:
      sortOrder === "recent"
        ? visible.reverse()
        : visible.sort(SORT_COMPARATORS[sortOrder]),
    counts,
  };
}
