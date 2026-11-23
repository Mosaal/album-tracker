import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { Divider, Flex, theme } from "antd";
import { createStyles } from "antd-style";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { AlbumGroup } from "../../albums/albumList";
import { useMediaQuery } from "../../hooks";
import { Album, AlbumViewMode, GridDensity } from "../../types";
import { AlbumCard } from "../AlbumCard";
import { AlbumRow } from "../AlbumRow";
import { AlbumSection, AlbumSectionHeading } from "../AlbumSection";

/** Up to this many albums are all built; above it, only those near the screen. */
const BUILD_ALL_UP_TO = 100;

// Albums in each row, from the widest screens down to phones.
const GRID_COLUMNS: Record<GridDensity, number[]> = {
  normal: [5, 4, 3, 2, 1],
  compact: [6, 5, 4, 3, 2],
};

// The space between albums, across and down.
const GAP = 16;

// Rough heights, until a row has been built and measured: a card's details
// and buttons below its square cover, a list row, and a heading, with the
// divider above every heading but the first. Built rows are measured, and
// measured again whenever they change size.
const CARD_DETAILS_HEIGHT: Record<GridDensity, number> = {
  normal: 181,
  compact: 157,
};
const LIST_ROW_HEIGHT = 98;
const HEADING_HEIGHT = 36;
const DIVIDER_HEIGHT = 49;

// minmax(0, 1fr) rather than 1fr so wide covers shrink instead of overflowing.
const gridColumns = (count: number) => `repeat(${count}, minmax(0, 1fr))`;

const useStyles = createStyles(({ responsive }, density: GridDensity) => {
  const [widest, lg, md, sm, xs] = GRID_COLUMNS[density];
  return {
    grid: {
      display: "grid",
      gridTemplateColumns: gridColumns(widest),
      gap: GAP,
      // Max-width queries overlap: keep them widest first so the narrowest wins.
      [responsive.lg]: { gridTemplateColumns: gridColumns(lg) },
      [responsive.md]: { gridTemplateColumns: gridColumns(md) },
      [responsive.sm]: { gridTemplateColumns: gridColumns(sm) },
      [responsive.xs]: { gridTemplateColumns: gridColumns(xs) },
    },
    rows: { position: "relative" },
    row: { position: "absolute", top: 0, left: 0, width: "100%" },
  };
});

/** How many albums fit across, at the same breakpoints as the grid's styles. */
function useGridColumns(density: GridDensity) {
  const { token } = theme.useToken();
  const [widest, lg, md, sm, xs] = GRID_COLUMNS[density];
  const isXs = useMediaQuery(`(max-width: ${token.screenXSMax}px)`);
  const isSm = useMediaQuery(`(max-width: ${token.screenSMMax}px)`);
  const isMd = useMediaQuery(`(max-width: ${token.screenMDMax}px)`);
  const isLg = useMediaQuery(`(max-width: ${token.screenLGMax}px)`);
  return isXs ? xs : isSm ? sm : isMd ? md : isLg ? lg : widest;
}

interface AlbumViewProps {
  /** The albums shown, in order. */
  albums: Album[];
  /** The same albums in sections, when they're grouped. */
  groups?: AlbumGroup[];
  viewMode: AlbumViewMode;
  density: GridDensity;
  /** The albums picked, in selection mode, or undefined outside it. */
  selectedIds?: Set<string>;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onStatusChange: (album: Album, status: Album["status"]) => void;
  onToggleSelected: (album: Album) => void;
}

/**
 * The albums shown, as cards in a grid or rows in a list, in sections when
 * they're grouped. A long collection only has the rows near the screen built,
 * as a couple of thousand antd cards take seconds to build.
 */
export function AlbumView(props: AlbumViewProps) {
  return props.albums.length > BUILD_ALL_UP_TO ? (
    <VirtualAlbumView {...props} />
  ) : (
    <PlainAlbumView {...props} />
  );
}

/** Renders one album, as a card in the grid or a row in the list. */
const renderAlbum = (
  {
    viewMode,
    density,
    selectedIds,
    onEdit,
    onDelete,
    onStatusChange,
    onToggleSelected,
  }: AlbumViewProps,
  album: Album,
) =>
  viewMode === "grid" ? (
    <AlbumCard
      key={album.id}
      album={album}
      compact={density === "compact"}
      selected={selectedIds?.has(album.id)}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
      onToggleSelected={onToggleSelected}
    />
  ) : (
    <AlbumRow
      key={album.id}
      album={album}
      selected={selectedIds?.has(album.id)}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
      onToggleSelected={onToggleSelected}
    />
  );

/** Every album built at once, for collections short enough. */
function PlainAlbumView(props: AlbumViewProps) {
  const { albums, groups, viewMode, density } = props;
  const { styles } = useStyles(density);

  const renderAlbums = (shown: Album[]) =>
    viewMode === "grid" ? (
      <div className={styles.grid}>
        {shown.map((album) => renderAlbum(props, album))}
      </div>
    ) : (
      <Flex vertical gap={GAP}>
        {shown.map((album) => renderAlbum(props, album))}
      </Flex>
    );

  if (!groups) {
    return renderAlbums(albums);
  }
  return (
    <div>
      {groups.map((group, index) => (
        <Fragment key={group.key}>
          {index > 0 && <Divider />}
          <AlbumSection title={group.label} count={group.albums.length}>
            {renderAlbums(group.albums)}
          </AlbumSection>
        </Fragment>
      ))}
    </div>
  );
}

/** A heading, or a row of albums, in a long collection. */
type Item =
  | { type: "heading"; key: string; group: AlbumGroup; isFirst: boolean }
  | { type: "albums"; key: string; albums: Album[]; isLast: boolean };

/**
 * Splits the albums into rows of `perRow`, with a heading before each
 * section's. Keys start with `shape`, so a row measured in one layout isn't
 * taken for one in another.
 */
function toItems(
  albums: Album[],
  groups: AlbumGroup[] | undefined,
  perRow: number,
  shape: string,
) {
  const items: Item[] = [];
  const sections = groups ?? [{ key: "", label: "", albums }];
  sections.forEach((group, index) => {
    if (groups) {
      items.push({
        type: "heading",
        key: `${shape}:heading:${group.key}`,
        group,
        isFirst: index === 0,
      });
    }
    for (let start = 0; start < group.albums.length; start += perRow) {
      const row = group.albums.slice(start, start + perRow);
      items.push({
        type: "albums",
        key: `${shape}:${row[0].id}`,
        albums: row,
        isLast: start + perRow >= group.albums.length,
      });
    }
  });
  return items;
}

/** Only the rows near the screen built, for long collections. */
function VirtualAlbumView(props: AlbumViewProps) {
  const { albums, groups, viewMode, density } = props;
  const { styles } = useStyles(density);
  const columns = useGridColumns(density);
  const perRow = viewMode === "grid" ? columns : 1;
  const items = toItems(albums, groups, perRow, `${viewMode}-${perRow}`);

  // Where the list starts on the page, below the toolbar, and how wide it is.
  const listRef = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState(() => ({
    top: 0,
    width: window.innerWidth,
  }));
  useLayoutEffect(() => {
    const list = listRef.current!;
    const update = () => {
      const rect = list.getBoundingClientRect();
      const top = Math.round(rect.top + window.scrollY);
      const width = Math.round(rect.width);
      setPlace((current) =>
        current.top === top && current.width === width
          ? current
          : { top, width },
      );
    };
    // Anything above the list that changes size changes the page's size too.
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const estimate = (item: Item) => {
    if (item.type === "heading") {
      return HEADING_HEIGHT + (item.isFirst ? 0 : DIVIDER_HEIGHT);
    }
    const gap = item.isLast ? 0 : GAP;
    if (viewMode === "list") {
      return LIST_ROW_HEIGHT + gap;
    }
    const coverWidth = (place.width - GAP * (columns - 1)) / columns;
    return coverWidth + CARD_DETAILS_HEIGHT[density] + gap;
  };

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (index) => estimate(items[index]),
    getItemKey: (index) => items[index].key,
    // A couple of rows beyond the screen, so Tab and quick scrolling find
    // albums already built.
    overscan: 2,
    scrollMargin: place.top,
    // Unrounded, so rows sit exactly where the grid's would. jsdom measures
    // everything as 0 tall: the estimate keeps tests in proportion.
    measureElement: (element, entry) =>
      (entry?.borderBoxSize[0]?.blockSize ??
        element.getBoundingClientRect().height) ||
      estimate(items[Number(element.getAttribute("data-index"))]),
  });

  return (
    <div
      ref={listRef}
      className={styles.rows}
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map(({ index, key, start }) => {
        const item = items[index];
        return (
          <div
            key={key}
            ref={virtualizer.measureElement}
            data-index={index}
            className={styles.row}
            style={{ transform: `translateY(${start - place.top}px)` }}
          >
            {item.type === "heading" ? (
              <>
                {!item.isFirst && <Divider />}
                <AlbumSectionHeading
                  title={item.group.label}
                  count={item.group.albums.length}
                />
              </>
            ) : (
              <div
                className={viewMode === "grid" ? styles.grid : undefined}
                style={{
                  gridTemplateColumns:
                    viewMode === "grid" ? gridColumns(columns) : undefined,
                  paddingBottom: item.isLast ? 0 : GAP,
                }}
              >
                {item.albums.map((album) => renderAlbum(props, album))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
