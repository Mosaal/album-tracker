import { useMemo, useState } from "react";
import { Button, Empty, Flex, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";
import {
  AlbumCard,
  AlbumFilters,
  AlbumFormModal,
  AlbumRow,
  AlbumViewToggle,
  BackupMenu,
  Layout,
} from "./components";
import { useAlbums } from "./hooks";
import {
  Album,
  AlbumInput,
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

export default function App() {
  const { styles } = useAlbumGridStyles();
  const {
    albums,
    addAlbum,
    updateAlbum,
    setAlbumStatus,
    deleteAlbum,
    importAlbums,
  } = useAlbums();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<AlbumSortOrder>("title-asc");
  const [statusFilter, setStatusFilter] = useState<AlbumStatusFilter>("all");
  const [viewMode, setViewMode] = useState<AlbumViewMode>("grid");
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Not cleared on close, so the modal keeps its title while it animates out.
  const [editingAlbum, setEditingAlbum] = useState<Album>();
  // Rendered inside Layout below, so confirm dialogs pick up the theme.
  const [modal, modalContextHolder] = Modal.useModal();

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
  }, [albums, search, sortOrder, statusFilter]);

  const openAddForm = () => {
    setEditingAlbum(undefined);
    setIsFormOpen(true);
  };

  const openEditForm = (album: Album) => {
    setEditingAlbum(album);
    setIsFormOpen(true);
  };

  const handleFormSubmit = (input: AlbumInput) => {
    if (editingAlbum) {
      updateAlbum(editingAlbum.id, input);
    } else {
      addAlbum(input);
    }
    setIsFormOpen(false);
  };

  const changeStatus = (album: Album, status: Album["status"]) => {
    setAlbumStatus(album.id, status);
  };

  const confirmDelete = (album: Album) => {
    modal.confirm({
      title: "Delete this album?",
      content: `"${album.title}" by ${album.artist} will be permanently removed.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      // Start on Cancel so pressing Enter can't delete by accident.
      focusable: { autoFocusButton: "cancel" },
      onOk: () => deleteAlbum(album.id),
    });
  };

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
          <Flex gap="16px" align="center">
            <AlbumViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAddForm}
            >
              Add album
            </Button>
            <BackupMenu albums={albums} onImport={importAlbums} />
          </Flex>
        </Flex>
        {visibleAlbums.length === 0 ? (
          <Empty
            description={
              albums.length === 0
                ? "No albums yet"
                : "No albums match your search or filter"
            }
          >
            {albums.length === 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddForm}
              >
                Add your first album
              </Button>
            )}
          </Empty>
        ) : viewMode === "grid" ? (
          <div className={styles.grid}>
            {visibleAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onEdit={openEditForm}
                onDelete={confirmDelete}
                onStatusChange={changeStatus}
              />
            ))}
          </div>
        ) : (
          <Flex vertical gap="16px">
            {visibleAlbums.map((album) => (
              <AlbumRow
                key={album.id}
                album={album}
                onEdit={openEditForm}
                onDelete={confirmDelete}
                onStatusChange={changeStatus}
              />
            ))}
          </Flex>
        )}
      </Flex>
      <AlbumFormModal
        open={isFormOpen}
        album={editingAlbum}
        onSubmit={handleFormSubmit}
        onCancel={() => setIsFormOpen(false)}
      />
      {modalContextHolder}
    </Layout>
  );
}
