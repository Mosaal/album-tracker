export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  status: "owned" | "wishlisted";
}

export type AlbumSortOrder =
  "title-asc" | "title-desc" | "artist-asc" | "artist-desc";

export type AlbumStatusFilter = "all" | Album["status"];
