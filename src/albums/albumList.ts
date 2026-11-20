import {
  Album,
  AlbumDecadeFilter,
  AlbumFormatFilter,
  AlbumSortOrder,
  AlbumStatusFilter,
} from "../types";
import { decadeOf } from "./albumYears";
import { timeOf } from "./timestamps";

type Comparator = (a: Album, b: Album) => number;

const byArtistAndTitle: Comparator = (a, b) =>
  a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);

/** Oldest or newest first, with albums that have no year last either way. */
const byYear =
  (direction: 1 | -1): Comparator =>
  (a, b) => {
    if (a.year === b.year) {
      return byArtistAndTitle(a, b);
    }
    if (a.year === undefined || b.year === undefined) {
      return a.year === undefined ? 1 : -1;
    }
    return (a.year - b.year) * direction;
  };

const SORT_COMPARATORS: Record<AlbumSortOrder, Comparator> = {
  "title-asc": (a, b) => a.title.localeCompare(b.title),
  "title-desc": (a, b) => b.title.localeCompare(a.title),
  "artist-asc": (a, b) => a.artist.localeCompare(b.artist),
  "artist-desc": (a, b) => b.artist.localeCompare(a.artist),
  "year-asc": byYear(1),
  "year-desc": byYear(-1),
  recent: (a, b) => {
    const [first, second] = [timeOf(a.addedAt), timeOf(b.addedAt)];
    return first === second ? 0 : first > second ? -1 : 1;
  },
};

export const isSortOrder = (value: unknown): value is AlbumSortOrder =>
  typeof value === "string" && Object.keys(SORT_COMPARATORS).includes(value);

interface AlbumListOptions {
  search: string;
  sortOrder: AlbumSortOrder;
  statusFilter: AlbumStatusFilter;
  formatFilter: AlbumFormatFilter;
  /** Only this artist's albums, or every artist's when left out. */
  artistFilter?: string;
  /** Only the albums from a decade, or with no year. All when left out. */
  decadeFilter?: AlbumDecadeFilter;
}

/** An artist as compared: in any case, without spaces around the name. */
const artistKey = (artist: string) => artist.trim().toLowerCase();

/** Each artist in the collection once, alphabetically, whatever the case. */
export function listArtists(albums: Album[]) {
  const artists = new Map<string, string>();
  for (const { artist } of albums) {
    const key = artistKey(artist);
    if (!artists.has(key)) {
      artists.set(key, artist.trim());
    }
  }
  return [...artists.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * The decades to filter by, oldest first, then "none" if some albums have no
 * year. Empty when no album has a year, as there's nothing to filter by.
 */
export function listDecades(albums: Album[]): AlbumDecadeFilter[] {
  const decades = new Set<number>();
  for (const { year } of albums) {
    if (year !== undefined) {
      decades.add(decadeOf(year));
    }
  }
  if (decades.size === 0) {
    return [];
  }
  const sorted = [...decades].sort((a, b) => a - b);
  return albums.some((album) => album.year === undefined)
    ? [...sorted, "none"]
    : sorted;
}

const isInDecade = (album: Album, decade: AlbumDecadeFilter) =>
  decade === "all" ||
  (decade === "none"
    ? album.year === undefined
    : album.year !== undefined && decadeOf(album.year) === decade);

/** Picks the albums that match the search and filters, in order. */
export function selectAlbums(
  albums: Album[],
  {
    search,
    sortOrder,
    statusFilter,
    formatFilter,
    artistFilter,
    decadeFilter = "all",
  }: AlbumListOptions,
) {
  const query = search.trim().toLowerCase();
  const visible = albums.filter(
    (album) =>
      (statusFilter === "all" || album.status === statusFilter) &&
      (formatFilter === "all" || album.format === formatFilter) &&
      (artistFilter === undefined ||
        artistKey(album.artist) === artistKey(artistFilter)) &&
      isInDecade(album, decadeFilter) &&
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
