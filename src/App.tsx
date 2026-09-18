import { useMemo, useState } from "react";
import { Flex } from "antd";
import {
  AlbumCard,
  AlbumFilters,
  AlbumRow,
  AlbumViewToggle,
  Layout,
} from "./components";
import {
  Album,
  AlbumSortOrder,
  AlbumStatusFilter,
  AlbumViewMode,
} from "./types";

const SORT_COMPARATORS: Record<AlbumSortOrder, (a: Album, b: Album) => number> =
  {
    "title-asc": (a, b) => a.title.localeCompare(b.title),
    "title-desc": (a, b) => b.title.localeCompare(a.title),
    "artist-asc": (a, b) => a.artist.localeCompare(b.artist),
    "artist-desc": (a, b) => b.artist.localeCompare(a.artist),
  };

const albums: Album[] = [
  {
    id: "1",
    title: "Europe Street beat",
    artist: "Artist Name",
    coverUrl: "https://placehold.co/600",
    status: "owned",
  },
  {
    id: "2",
    title: "Another Album",
    artist: "Another Artist",
    coverUrl: "https://placehold.co/600",
    status: "wishlisted",
  },
  {
    id: "3",
    title: "Third Album",
    artist: "Third Artist",
    coverUrl: "https://placehold.co/600",
    status: "owned",
  },
];

export default function App() {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<AlbumSortOrder>("title-asc");
  const [statusFilter, setStatusFilter] = useState<AlbumStatusFilter>("all");
  const [viewMode, setViewMode] = useState<AlbumViewMode>("grid");

  const visibleAlbums = useMemo(() => {
    const query = search.trim().toLowerCase();

    return albums
      .filter((album) => {
        const matchesStatus =
          statusFilter === "all" || album.status === statusFilter;
        const matchesQuery =
          query === "" ||
          album.title.toLowerCase().includes(query) ||
          album.artist.toLowerCase().includes(query);

        return matchesStatus && matchesQuery;
      })
      .sort(SORT_COMPARATORS[sortOrder]);
  }, [search, sortOrder, statusFilter]);

  return (
    <Layout>
      <Flex vertical gap="16px">
        <Flex justify="space-between" align="center" gap="16px" wrap>
          <AlbumFilters
            search={search}
            onSearchChange={setSearch}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
          <AlbumViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </Flex>
        {viewMode === "grid" ? (
          <Flex gap="16px">
            {visibleAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </Flex>
        ) : (
          <Flex vertical gap="16px">
            {visibleAlbums.map((album) => (
              <AlbumRow key={album.id} album={album} />
            ))}
          </Flex>
        )}
      </Flex>
    </Layout>
  );
}
