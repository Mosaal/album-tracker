import {
  Album,
  AlbumFormatFilter,
  AlbumSortOrder,
  AlbumStatusFilter,
} from "./types";

const SORT_COMPARATORS: Record<
  Exclude<AlbumSortOrder, "recent">,
  (a: Album, b: Album) => number
> = {
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "title-desc": (a, b) => b.title.localeCompare(a.title),
  "artist-asc": (a, b) => a.artist.localeCompare(b.artist),
  "artist-desc": (a, b) => b.artist.localeCompare(a.artist),
};

interface AlbumListOptions {
  search: string;
  sortOrder: AlbumSortOrder;
  statusFilter: AlbumStatusFilter;
  formatFilter: AlbumFormatFilter;
}

/** Picks the albums that match the search and filters, in order. */
export function selectAlbums(
  albums: Album[],
  { search, sortOrder, statusFilter, formatFilter }: AlbumListOptions,
) {
  const query = search.trim().toLowerCase();
  const visible = albums.filter(
    (album) =>
      (statusFilter === "all" || album.status === statusFilter) &&
      (formatFilter === "all" || album.format === formatFilter) &&
      (query === "" ||
        album.title.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query)),
  );

  // Albums are stored in the order they were added, so the newest is last.
  return sortOrder === "recent"
    ? visible.reverse()
    : visible.sort(SORT_COMPARATORS[sortOrder]);
}
