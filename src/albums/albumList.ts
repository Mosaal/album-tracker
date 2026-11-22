import {
  Album,
  AlbumDecadeFilter,
  AlbumFormatFilter,
  AlbumGrouping,
  AlbumSortOrder,
  AlbumStatusFilter,
} from "../types";
import { FORMAT_LABELS, FORMAT_OPTIONS } from "./albumFormats";
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

/** A section of the albums shown, like an artist's or a decade's. */
export interface AlbumGroup {
  key: string;
  /** Its heading, like "Radiohead", "1990s", "Vinyl" or "B". */
  label: string;
  albums: Album[];
}

const GROUPINGS: AlbumGrouping[] = [
  "none",
  "artist",
  "decade",
  "format",
  "letter",
];

export const isGrouping = (value: unknown): value is AlbumGrouping =>
  GROUPINGS.includes(value as AlbumGrouping);

/** The section an album goes in, and that section's place among the others. */
interface Section {
  key: string;
  label: string;
  rank: number | string;
  /** For albums without what's grouped by, like a year, which go last. */
  isLast?: boolean;
}

const FORMAT_ORDER = FORMAT_OPTIONS.map(({ value }) => value);

/**
 * The letter something is filed under: its first, in capitals and without
 * accents, after any punctuation, so "(What's the Story)" goes under W and
 * "Ágætis byrjun" under A. Something starting with a number goes under #.
 */
function initialOf(text: string) {
  const match = /[\p{L}\p{N}]/u.exec(text.normalize("NFD"));
  const [initial = ""] = match?.[0].toUpperCase() ?? "";
  return /\p{L}/u.test(initial) ? initial : "#";
}

const sortsByArtist = (sortOrder: AlbumSortOrder) =>
  sortOrder === "artist-asc" || sortOrder === "artist-desc";

function sectionOf(
  album: Album,
  grouping: Exclude<AlbumGrouping, "none">,
  sortOrder: AlbumSortOrder,
): Section {
  switch (grouping) {
    case "artist": {
      const label = album.artist.trim();
      return { key: artistKey(album.artist), label, rank: label };
    }
    case "decade": {
      if (album.year === undefined) {
        return { key: "none", label: "No year", rank: 0, isLast: true };
      }
      const decade = decadeOf(album.year);
      return { key: String(decade), label: `${decade}s`, rank: decade };
    }
    case "format":
      return album.format
        ? {
            key: album.format,
            label: FORMAT_LABELS[album.format],
            rank: FORMAT_ORDER.indexOf(album.format),
          }
        : { key: "none", label: "No format", rank: 0, isLast: true };
    case "letter": {
      // By artist when sorted by artist, like the bins in a record shop.
      const initial = initialOf(
        sortsByArtist(sortOrder) ? album.artist : album.title,
      );
      return {
        key: initial,
        label: initial,
        rank: initial,
        isLast: initial === "#",
      };
    }
  }
}

/** Sections run backwards when the albums are sorted backwards by the same thing. */
function runsBackwards(
  grouping: Exclude<AlbumGrouping, "none">,
  sortOrder: AlbumSortOrder,
) {
  switch (grouping) {
    case "artist":
      return sortOrder === "artist-desc";
    case "decade":
      return sortOrder === "year-desc";
    case "letter":
      return sortOrder === "title-desc" || sortOrder === "artist-desc";
    case "format":
      return false;
  }
}

/**
 * Splits the albums shown into sections, keeping their order within each.
 * Sections go alphabetically, from the oldest decade, or in the formats'
 * usual order, and backwards when the albums are sorted backwards by the
 * same thing. Albums without what's grouped by, like a year, come last.
 */
export function groupAlbums(
  albums: Album[],
  grouping: Exclude<AlbumGrouping, "none">,
  sortOrder: AlbumSortOrder,
): AlbumGroup[] {
  const sections = new Map<string, { section: Section; albums: Album[] }>();
  for (const album of albums) {
    const section = sectionOf(album, grouping, sortOrder);
    const known = sections.get(section.key);
    if (known) {
      known.albums.push(album);
    } else {
      sections.set(section.key, { section, albums: [album] });
    }
  }

  const direction = runsBackwards(grouping, sortOrder) ? -1 : 1;
  return [...sections.values()]
    .sort(({ section: a }, { section: b }) => {
      if (Boolean(a.isLast) !== Boolean(b.isLast)) {
        return a.isLast ? 1 : -1;
      }
      const order =
        typeof a.rank === "number" && typeof b.rank === "number"
          ? a.rank - b.rank
          : String(a.rank).localeCompare(String(b.rank));
      return order * direction;
    })
    .map(({ section, albums }) => ({
      key: section.key,
      label: section.label,
      albums,
    }));
}
