import { useMemo, useState } from "react";
import { Button, Empty, Flex, message, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";
import { selectAlbums } from "./albumList";
import {
  AlbumCard,
  AlbumFilters,
  AlbumFormModal,
  AlbumRow,
  AlbumViewToggle,
  ImportExportMenu,
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

const useStyles = createStyles(({ responsive }) => ({
  grid: {
    display: "grid",
    gridTemplateColumns: gridColumns(5),
    gap: 16,
    // Max-width queries overlap: keep them widest first so the narrowest wins.
    [responsive.lg]: { gridTemplateColumns: gridColumns(4) },
    [responsive.md]: { gridTemplateColumns: gridColumns(3) },
    [responsive.sm]: { gridTemplateColumns: gridColumns(2) },
    [responsive.xs]: { gridTemplateColumns: gridColumns(1) },
  },
  // On phones the view toggle and the buttons sit at either end of the row.
  actions: { [responsive.xs]: { width: "100%" } },
}));

export default function App() {
  const { styles } = useStyles();
  const {
    albums,
    addAlbum,
    updateAlbum,
    setAlbumStatus,
    deleteAlbums,
    importAlbums,
  } = useAlbums();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<AlbumSortOrder>("title-asc");
  const [statusFilter, setStatusFilter] = useState<AlbumStatusFilter>("all");
  const [viewMode, setViewMode] = useState<AlbumViewMode>("grid");
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Not cleared on close, so the modal keeps its title while it animates out.
  const [editingAlbum, setEditingAlbum] = useState<Album>();
  // Rendered inside Layout below, so dialogs and messages pick up the theme.
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();

  const visibleAlbums = useMemo(
    () => selectAlbums(albums, { search, sortOrder, statusFilter }),
    [albums, search, sortOrder, statusFilter],
  );

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
      content: `"${album.title}" by ${album.artist} will be removed from your collection.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      // Start on Cancel so pressing Enter can't delete by accident.
      focusable: { autoFocusButton: "cancel" },
      onOk: () => {
        const restore = deleteAlbums([album.id]);
        const key = `deleted-${album.id}`;
        messageApi.success({
          key,
          content: (
            <>
              Deleted "{album.title}".
              <Button
                type="link"
                size="small"
                onClick={() => {
                  restore();
                  messageApi.destroy(key);
                }}
              >
                Undo
              </Button>
            </>
          ),
          // Long enough to notice the message and reach Undo.
          duration: 8,
        });
      },
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
            count={visibleAlbums.length}
          />
          <Flex
            gap="16px"
            align="center"
            justify="space-between"
            className={styles.actions}
          >
            <AlbumViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <Flex gap="16px">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddForm}
              >
                Add album
              </Button>
              <ImportExportMenu albums={albums} onImport={importAlbums} />
            </Flex>
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
      {messageContextHolder}
    </Layout>
  );
}
