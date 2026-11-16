import { Flex, Input, Select, Typography } from "antd";
import { createStyles } from "antd-style";

import { albumCount } from "../../albumFiles";
import { FORMAT_OPTIONS } from "../../albumFormats";
import {
  AlbumFormatFilter,
  AlbumSortOrder,
  AlbumStatusFilter,
} from "../../types";

// Sized so the toolbar fits on one line on a 1280px screen. On phones, each
// group gets a full-width row of its own, which its controls share.
const useStyles = createStyles(({ responsive }) => ({
  filters: { [responsive.xs]: { width: "100%" } },
  search: { width: 220, [responsive.xs]: { width: "100%" } },
  row: { [responsive.xs]: { width: "100%" } },
  sort: { width: 160, [responsive.xs]: { flex: 1, minWidth: 0 } },
  artist: { width: 150, [responsive.xs]: { flex: 1, minWidth: 0 } },
  // The status and format filters share their row up to the count.
  filter: { width: 130, [responsive.xs]: { flex: 1, minWidth: 0 } },
}));

// No artist goes by an empty name, so it stands for all of them.
const ALL_ARTISTS = "";

const SORT_OPTIONS: { value: AlbumSortOrder; label: string }[] = [
  { value: "title-asc", label: "Title (A-Z)" },
  { value: "title-desc", label: "Title (Z-A)" },
  { value: "artist-asc", label: "Artist (A-Z)" },
  { value: "artist-desc", label: "Artist (Z-A)" },
  { value: "recent", label: "Recently added" },
];

const STATUS_OPTIONS: { value: AlbumStatusFilter; label: string }[] = [
  { value: "all", label: "All albums" },
  { value: "owned", label: "Owned" },
  { value: "wishlisted", label: "Wishlisted" },
];

const FORMAT_FILTER_OPTIONS: { value: AlbumFormatFilter; label: string }[] = [
  { value: "all", label: "All formats" },
  ...FORMAT_OPTIONS,
];

interface AlbumFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  sortOrder: AlbumSortOrder;
  onSortOrderChange: (sortOrder: AlbumSortOrder) => void;
  statusFilter: AlbumStatusFilter;
  onStatusFilterChange: (statusFilter: AlbumStatusFilter) => void;
  formatFilter: AlbumFormatFilter;
  onFormatFilterChange: (formatFilter: AlbumFormatFilter) => void;
  /** Every artist in the collection, to pick from. */
  artists: string[];
  /** The artist whose albums are shown, or undefined for all of them. */
  artistFilter?: string;
  onArtistFilterChange: (artistFilter?: string) => void;
  /** How many albums match the search and filters. */
  count: number;
}

export function AlbumFilters({
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  statusFilter,
  onStatusFilterChange,
  formatFilter,
  onFormatFilterChange,
  artists,
  artistFilter,
  onArtistFilterChange,
  count,
}: AlbumFiltersProps) {
  const { styles } = useStyles();
  const artistOptions = [
    { value: ALL_ARTISTS, label: "All artists" },
    ...artists.map((artist) => ({ value: artist, label: artist })),
  ];

  return (
    <Flex gap="16px" wrap className={styles.filters}>
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by title or artist"
        allowClear
        aria-label="Search albums"
        className={styles.search}
      />
      <Flex gap="small" className={styles.row}>
        <Select
          value={sortOrder}
          onChange={onSortOrderChange}
          options={SORT_OPTIONS}
          aria-label="Sort order"
          className={styles.sort}
        />
        <Select
          value={artistFilter ?? ALL_ARTISTS}
          onChange={(artist) => onArtistFilterChange(artist || undefined)}
          options={artistOptions}
          showSearch={{ optionFilterProp: "label" }}
          // Wider than the filter, so long names fit.
          popupMatchSelectWidth={240}
          aria-label="Filter by artist"
          className={styles.artist}
        />
      </Flex>
      {/* Grouped so the count never wraps onto a line of its own. */}
      <Flex gap="small" align="center" className={styles.row}>
        <Select
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={STATUS_OPTIONS}
          aria-label="Filter by status"
          className={styles.filter}
        />
        <Select
          value={formatFilter}
          onChange={onFormatFilterChange}
          options={FORMAT_FILTER_OPTIONS}
          aria-label="Filter by format"
          className={styles.filter}
        />
        {/* A status role, so screen readers announce the count as it changes. */}
        <Typography.Text type="secondary" role="status">
          {albumCount(count)}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}
