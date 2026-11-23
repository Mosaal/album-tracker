import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button, Empty, Flex, message, Modal } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";
import { albumCount, describeMusicImport } from "./albums/albumFiles";
import { FORMAT_LABELS } from "./albums/albumFormats";
import {
  groupAlbums,
  listArtists,
  listDecades,
  selectAlbums,
} from "./albums/albumList";
import { createCollectionStore } from "./albums/albumStore";
import {
  AlbumFilters,
  AlbumFormModal,
  AlbumView,
  AlbumViewToggle,
  CoverFinderStatus,
  Layout,
  MoreActionsMenu,
  SelectionBar,
  SettingsDialog,
  SyncSettingsDialog,
  SyncSetupDialog,
  SyncStatusButton,
} from "./components";
import { describeCoverSearch, LOOKUP_EVERY_MS } from "./covers/coverFinder";
import { useAlbums, useCoverFinder, useGitHubSync, useSettings } from "./hooks";
import {
  Album,
  AlbumDecadeFilter,
  AlbumFormat,
  AlbumFormatFilter,
  AlbumInput,
  AlbumStatusFilter,
} from "./types";

// Loaded the first time it's opened, as few people need it.
const MusicFolderDialog = lazy(() =>
  import("./components/MusicFolderDialog").then((module) => ({
    default: module.MusicFolderDialog,
  })),
);

const useStyles = createStyles(({ responsive }) => ({
  // Kept at the end of the toolbar, even when it wraps onto a line of its
  // own. On phones the view toggle and the buttons sit at either end of it.
  actions: { marginInlineStart: "auto", [responsive.xs]: { width: "100%" } },
}));

export default function App() {
  const { settings, updateSettings } = useSettings();
  // Saved with the settings, so the app opens the way it was left.
  const { sortOrder, viewMode, grouping } = settings;
  const { styles } = useStyles();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [store] = useState(createCollectionStore);
  const {
    albums,
    addAlbum,
    updateAlbum,
    setAlbumsStatus,
    setAlbumsFormat,
    deleteAlbums,
    importAlbums,
    importMusicFolder,
  } = useAlbums(store);
  const sync = useGitHubSync(store);
  const isSyncConnected = sync.state.status !== "disconnected";
  const [syncDialog, setSyncDialog] = useState<"setup" | "settings">();
  // Undefined until it's first opened, so its code only loads then.
  const [isMusicFolderOpen, setIsMusicFolderOpen] = useState<boolean>();
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
  const coverFinder = useCoverFinder(store);
  // The albums picked in selection mode, or undefined outside it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>();
  const isSelecting = selectedIds !== undefined;

  useEffect(
    () =>
      coverFinder.onEnd((end, state) => {
        const content = describeCoverSearch(end, state);
        if (end === "offline" || end === "unavailable") {
          messageApi.warning(content);
        } else if (end === "done" && state.found > 0) {
          messageApi.success(content);
        } else {
          messageApi.info(content);
        }
      }),
    [coverFinder, messageApi],
  );

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
  const groups = useMemo(
    () =>
      grouping === "none"
        ? undefined
        : groupAlbums(visibleAlbums, grouping, sortOrder),
    [visibleAlbums, grouping, sortOrder],
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

  // The handlers given to every album are stable, so the memoised cards and
  // rows don't render again whenever App does.
  const openEditForm = useCallback((album: Album) => {
    setEditingAlbum(album);
    setIsFormOpen(true);
  }, []);

  const handleFormSubmit = (input: AlbumInput) => {
    if (editingAlbum) {
      updateAlbum(editingAlbum.id, input);
    } else {
      addAlbum(input);
    }
    setIsFormOpen(false);
  };

  const changeStatus = useCallback(
    (album: Album, status: Album["status"]) => {
      setAlbumsStatus([album.id], status);
    },
    [setAlbumsStatus],
  );

  /** Says what was deleted, with an Undo that brings it back. */
  const showDeleted = useCallback(
    (content: string, restore: () => void) => {
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
    },
    [messageApi],
  );

  const confirmDelete = useCallback(
    (album: Album) => {
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
    },
    [modal, showDeleted, deleteAlbums],
  );

  const toggleSelected = useCallback((album: Album) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(album.id)) {
        next.add(album.id);
      }
      return next;
    });
  }, []);

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

  const setSelectedFormat = (format: AlbumFormat) => {
    setAlbumsFormat(
      selectedAlbums.map((album) => album.id),
      format,
    );
    messageApi.success(
      `Set the format of ${albumCount(selectedAlbums.length)} to ${FORMAT_LABELS[format]}.`,
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

  const importFromMusicFolder = (
    found: Pick<AlbumInput, "title" | "artist" | "year" | "coverUrl">[],
    wishlisted: { id: string; coverUrl?: string }[],
    format: AlbumFormat,
  ) => {
    // Throws, leaving the dialog open, if the albums can't be saved.
    const { withoutCover, ...summary } = importMusicFolder(
      found,
      wishlisted,
      format,
    );
    setIsMusicFolderOpen(false);
    messageApi.success(describeMusicImport(summary));
    coverFinder.find(withoutCover);
  };

  const findMissingCovers = () => {
    const ids = albums.filter((album) => !album.coverUrl).map(({ id }) => id);
    const minutes = Math.round((ids.length * LOOKUP_EVERY_MS) / 60_000);
    modal.confirm({
      title: `Find covers for ${albumCount(ids.length)}?`,
      content: `Album Tracker looks each one up on MusicBrainz, about one a second, so it takes ${
        minutes < 1
          ? "under a minute"
          : `about ${minutes} minute${minutes === 1 ? "" : "s"}`
      }. Covers appear as they're found, while the app stays open.`,
      okText: "Find covers",
      onOk: () => coverFinder.find(ids),
    });
  };

  return (
    <Layout
      headerExtra={
        <Flex gap="small" align="center">
          <CoverFinderStatus finder={coverFinder} />
          <SyncStatusButton
            state={sync.state}
            onClick={() => setSyncDialog("settings")}
          />
        </Flex>
      }
    >
      <Flex vertical gap="16px">
        <Flex justify="space-between" align="center" gap="16px" wrap>
          <AlbumFilters
            search={search}
            onSearchChange={setSearch}
            sortOrder={sortOrder}
            onSortOrderChange={(sortOrder) => updateSettings({ sortOrder })}
            grouping={grouping}
            onGroupingChange={(grouping) => updateSettings({ grouping })}
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
                onImportMusicFolder={() => setIsMusicFolderOpen(true)}
                onSelectAlbums={() => setSelectedIds(new Set())}
                onFindMissingCovers={findMissingCovers}
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
            onSetFormat={setSelectedFormat}
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
        ) : (
          <AlbumView
            albums={visibleAlbums}
            groups={groups}
            viewMode={viewMode}
            density={settings.gridDensity}
            selectedIds={selectedIds}
            onEdit={openEditForm}
            onDelete={confirmDelete}
            onStatusChange={changeStatus}
            onToggleSelected={toggleSelected}
          />
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
      {isMusicFolderOpen !== undefined && (
        <Suspense>
          <MusicFolderDialog
            open={isMusicFolderOpen}
            albums={albums}
            onImport={importFromMusicFolder}
            onClose={() => setIsMusicFolderOpen(false)}
          />
        </Suspense>
      )}
      {modalContextHolder}
      {messageContextHolder}
    </Layout>
  );
}
