import { timeOf } from "./timestamps";
import {
  Album,
  AlbumFormatFilter,
  AlbumSortOrder,
  AlbumStatusFilter,
} from "./types";

type Comparator = (a: Album, b: Album) => number;

const SORT_COMPARATORS: Record<AlbumSortOrder, Comparator> = {
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "title-desc": (a, b) => b.title.localeCompare(a.title),
  "artist-asc": (a, b) => a.artist.localeCompare(b.artist),
  "artist-desc": (a, b) => b.artist.localeCompare(a.artist),
  recent: (a, b) => {
    const [first, second] = [timeOf(a.addedAt), timeOf(b.addedAt)];
    return first === second ? 0 : first > second ? -1 : 1;
  },
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

  // Albums from before dates were kept have none, so they sort last. Among
  // those, newest first is the reverse of the stored order they were added in.
  if (sortOrder === "recent") {
    visible.reverse();
  }
  return visible.sort(SORT_COMPARATORS[sortOrder]);
}
