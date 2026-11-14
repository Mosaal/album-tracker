export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  status: "owned" | "wishlisted";
}

export type AlbumInput = Omit<Album, "id">;

export type AlbumSortOrder =
  "title-asc" | "title-desc" | "artist-asc" | "artist-desc" | "recent";

export type AlbumStatusFilter = "all" | Album["status"];

export type AlbumViewMode = "grid" | "list";
