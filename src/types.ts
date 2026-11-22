export type AlbumFormat = "vinyl" | "cd" | "cassette" | "digital" | "other";

export interface Album {
  id: string;
  title: string;
  artist: string;
  /** The year it came out. */
  year?: number;
  coverUrl?: string;
  format?: AlbumFormat;
  status: "owned" | "wishlisted";
  /** Anything else worth noting, like the pressing or its condition. */
  notes?: string;
  /** When it joined the collection, as an ISO date. Unknown for older albums. */
  addedAt?: string;
  /** When it last changed, as an ISO date. Unknown for older albums. */
  updatedAt?: string;
}

/** What the add and edit form fills in. */
export type AlbumInput = Omit<Album, "id" | "addedAt" | "updatedAt">;

/** An album that was deleted, and when, so other copies of it can follow. */
export interface DeletedAlbum {
  id: string;
  deletedAt: string;
}

/** Everything saved about the collection. */
export interface Collection {
  albums: Album[];
  deleted: DeletedAlbum[];
}

export type AlbumSortOrder =
  | "title-asc"
  | "title-desc"
  | "artist-asc"
  | "artist-desc"
  | "year-asc"
  | "year-desc"
  | "recent";

export type AlbumStatusFilter = "all" | Album["status"];

export type AlbumFormatFilter = "all" | AlbumFormat;

/** A decade, by its first year (1950 for the 1950s), or albums with no year. */
export type AlbumDecadeFilter = "all" | "none" | number;

export type AlbumViewMode = "grid" | "list";

/** How the albums shown are split into sections, if they are. */
export type AlbumGrouping = "none" | "artist" | "decade" | "format" | "letter";

/** How many albums fit in each row of the grid. */
export type GridDensity = "normal" | "compact";

/** Choices saved on this device. */
export interface Settings {
  gridDensity: GridDensity;
  /** Filled in when adding an album. */
  defaultFormat?: AlbumFormat;
  /** The view, sort order and grouping last chosen, which the app opens with. */
  viewMode: AlbumViewMode;
  sortOrder: AlbumSortOrder;
  grouping: AlbumGrouping;
}
