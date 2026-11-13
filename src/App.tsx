import { useMemo, useState } from "react";
import { Flex } from "antd";
import { createStyles } from "antd-style";
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

// minmax(0, 1fr) rather than 1fr so wide covers shrink instead of overflowing.
const gridColumns = (count: number) => `repeat(${count}, minmax(0, 1fr))`;

const useAlbumGridStyles = createStyles(({ responsive }) => ({
  grid: {
    display: "grid",
    gridTemplateColumns: gridColumns(6),
    gap: 16,
    // Max-width queries overlap: keep them widest first so the narrowest wins.
    [responsive.lg]: { gridTemplateColumns: gridColumns(5) },
    [responsive.md]: { gridTemplateColumns: gridColumns(4) },
    [responsive.sm]: { gridTemplateColumns: gridColumns(3) },
    [responsive.xs]: { gridTemplateColumns: gridColumns(2) },
  },
}));

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
  const { styles } = useAlbumGridStyles();
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
          <div className={styles.grid}>
            {visibleAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
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
