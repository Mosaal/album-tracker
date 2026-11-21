import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, message, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";
import { albumCount } from "./albums/albumFiles";
import { listArtists, listDecades, selectAlbums } from "./albums/albumList";
import { createCollectionStore } from "./albums/albumStore";
import {
  AlbumCard,
  AlbumFilters,
  AlbumFormModal,
  AlbumRow,
  AlbumViewToggle,
  Layout,
  MoreActionsMenu,
  SelectionBar,
  SettingsDialog,
  SyncSettingsDialog,
  SyncSetupDialog,
  SyncStatusButton,
} from "./components";
import { useAlbums, useGitHubSync, useSettings } from "./hooks";
import {
  Album,
  AlbumDecadeFilter,
  AlbumFormatFilter,
  AlbumInput,
  AlbumStatusFilter,
  GridDensity,
} from "./types";

// minmax(0, 1fr) rather than 1fr so wide covers shrink instead of overflowing.
const gridColumns = (count: number) => `repeat(${count}, minmax(0, 1fr))`;

// Albums in each row, from the widest screens down to phones.
const GRID_COLUMNS: Record<GridDensity, number[]> = {
  normal: [5, 4, 3, 2, 1],
  compact: [6, 5, 4, 3, 2],
};

const useStyles = createStyles(({ responsive }, density: GridDensity) => {
  const [widest, lg, md, sm, xs] = GRID_COLUMNS[density];
  return {
    grid: {
      display: "grid",
      gridTemplateColumns: gridColumns(widest),
      gap: 16,
      // Max-width queries overlap: keep them widest first so the narrowest wins.
      [responsive.lg]: { gridTemplateColumns: gridColumns(lg) },
      [responsive.md]: { gridTemplateColumns: gridColumns(md) },
      [responsive.sm]: { gridTemplateColumns: gridColumns(sm) },
      [responsive.xs]: { gridTemplateColumns: gridColumns(xs) },
    },
    // Kept at the end of the toolbar, even when it wraps onto a line of its
    // own. On phones the view toggle and the buttons sit at either end of it.
    actions: { marginInlineStart: "auto", [responsive.xs]: { width: "100%" } },
  };
});

export default function App() {
  const { settings, updateSettings } = useSettings();
  // Saved with the settings, so the app opens the way it was left.
  const { sortOrder, viewMode } = settings;
  const { styles } = useStyles(settings.gridDensity);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [store] = useState(createCollectionStore);
  const {
    albums,
    addAlbum,
    updateAlbum,
    setAlbumsStatus,
    deleteAlbums,
    importAlbums,
  } = useAlbums(store);
  const sync = useGitHubSync(store);
  const isSyncConnected = sync.state.status !== "disconnected";
  const [syncDialog, setSyncDialog] = useState<"setup" | "settings">();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AlbumStatusFilter>("all");
  const [formatFilter, setFormatFilter] = useState<AlbumFormatFilter>("all");
  const [artistFilter, setArtistFilter] = useState<string>();
  const [decadeFilter, setDecadeFilter] = useState<AlbumDecadeFilter>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  // Not cleared on close, so the modal keeps its title while it animates out.
  const [editingAlbum, setEditingAlbum] = useState<Album>();
  // Rendered inside Layout below, so dialogs and messages pick up the theme.
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  // The albums picked in selection mode, or undefined outside it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>();
  const isSelecting = selectedIds !== undefined;

  const artists = useMemo(() => listArtists(albums), [albums]);
  const decades = useMemo(() => listDecades(albums), [albums]);
  // A decade that's no longer on offer stops filtering, so a hidden year
  // filter can't hide albums.
  const activeDecade = decades.includes(decadeFilter) ? decadeFilter : "all";
  const visibleAlbums = useMemo(
    () =>
      selectAlbums(albums, {
        search,
        sortOrder,
        statusFilter,
        formatFilter,
        artistFilter,
        decadeFilter: activeDecade,
      }),
    [
      albums,
      search,
      sortOrder,
      statusFilter,
      formatFilter,
      artistFilter,
      activeDecade,
    ],
  );
  // Only albums still shown count, so a filter can't hide what gets changed.
  const selectedAlbums = selectedIds
    ? visibleAlbums.filter((album) => selectedIds.has(album.id))
    : [];

  useEffect(() => {
    if (!isSelecting) {
      return;
    }
    const stopOnEscape = (event: KeyboardEvent) => {
      // Escape in a dialog only closes the dialog.
      const target = event.target as Element | null;
      if (event.key === "Escape" && !target?.closest?.('[role="dialog"]')) {
        setSelectedIds(undefined);
      }
    };
    document.addEventListener("keydown", stopOnEscape);
    return () => document.removeEventListener("keydown", stopOnEscape);
  }, [isSelecting]);

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
    setAlbumsStatus([album.id], status);
  };

  /** Says what was deleted, with an Undo that brings it back. */
  const showDeleted = (content: string, restore: () => void) => {
    const key = crypto.randomUUID();
    messageApi.success({
      key,
      content: (
        <>
          {content}
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
        showDeleted(`Deleted "${album.title}".`, deleteAlbums([album.id]));
      },
    });
  };

  const toggleSelected = (album: Album) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(album.id)) {
        next.add(album.id);
      }
      return next;
    });
  };

  const selectionOf = (album: Album) =>
    selectedIds && {
      selected: selectedIds.has(album.id),
      onToggle: toggleSelected,
    };

  const markSelected = (status: Album["status"]) => {
    setAlbumsStatus(
      selectedAlbums.map((album) => album.id),
      status,
    );
    messageApi.success(
      `Marked ${albumCount(selectedAlbums.length)} as ${status}.`,
    );
    setSelectedIds(undefined);
  };

  const confirmDeleteSelected = () => {
    const count = albumCount(selectedAlbums.length);
    const ids = selectedAlbums.map((album) => album.id);
    modal.confirm({
      title: `Delete ${count}?`,
      content: "They'll be removed from your collection.",
      okText: "Delete",
      okButtonProps: { danger: true },
      focusable: { autoFocusButton: "cancel" },
      onOk: () => {
        showDeleted(`Deleted ${count}.`, deleteAlbums(ids));
        setSelectedIds(undefined);
      },
    });
  };

  return (
    <Layout
      headerExtra={
        <SyncStatusButton
          state={sync.state}
          onClick={() => setSyncDialog("settings")}
        />
      }
    >
      <Flex vertical gap="16px">
        <Flex justify="space-between" align="center" gap="16px" wrap>
          <AlbumFilters
            search={search}
            onSearchChange={setSearch}
            sortOrder={sortOrder}
            onSortOrderChange={(sortOrder) => updateSettings({ sortOrder })}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            formatFilter={formatFilter}
            onFormatFilterChange={setFormatFilter}
            artists={artists}
            artistFilter={artistFilter}
            onArtistFilterChange={setArtistFilter}
            decades={decades}
            decadeFilter={activeDecade}
            onDecadeFilterChange={setDecadeFilter}
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
              onViewModeChange={(viewMode) => updateSettings({ viewMode })}
            />
            <Flex gap="16px">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddForm}
              >
                Add album
              </Button>
              <MoreActionsMenu
                albums={albums}
                onImport={importAlbums}
                onSelectAlbums={() => setSelectedIds(new Set())}
                isSyncConnected={isSyncConnected}
                onOpenSync={() =>
                  setSyncDialog(isSyncConnected ? "settings" : "setup")
                }
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </Flex>
          </Flex>
        </Flex>
        {isSelecting && (
          <SelectionBar
            count={selectedAlbums.length}
            allSelected={
              visibleAlbums.length > 0 &&
              selectedAlbums.length === visibleAlbums.length
            }
            onSelectAll={() =>
              setSelectedIds(new Set(visibleAlbums.map((album) => album.id)))
            }
            onDeselectAll={() => setSelectedIds(new Set())}
            onMarkOwned={() => markSelected("owned")}
            onMarkWishlisted={() => markSelected("wishlisted")}
            onDelete={confirmDeleteSelected}
            onClose={() => setSelectedIds(undefined)}
          />
        )}
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
                selection={selectionOf(album)}
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
                selection={selectionOf(album)}
              />
            ))}
          </Flex>
        )}
      </Flex>
      <AlbumFormModal
        open={isFormOpen}
        album={editingAlbum}
        albums={albums}
        defaultFormat={settings.defaultFormat}
        onSubmit={handleFormSubmit}
        onCancel={() => setIsFormOpen(false)}
      />
      <SyncSetupDialog
        open={syncDialog === "setup" && !isSyncConnected}
        engine={sync.engine}
        albums={albums}
        onConnected={(repo) => {
          setSyncDialog(undefined);
          messageApi.success(`Syncing with ${repo}.`);
        }}
        onCancel={() => setSyncDialog(undefined)}
      />
      <SyncSettingsDialog
        open={syncDialog === "settings" && isSyncConnected}
        engine={sync.engine}
        state={sync.state}
        onClose={() => setSyncDialog(undefined)}
      />
      <SettingsDialog
        open={isSettingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setIsSettingsOpen(false)}
      />
      {modalContextHolder}
      {messageContextHolder}
    </Layout>
  );
}
