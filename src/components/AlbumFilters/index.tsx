import { Flex, Input, Select, Typography } from "antd";
import { createStyles } from "antd-style";

import { albumCount } from "../../albums/albumFiles";
import { FORMAT_OPTIONS } from "../../albums/albumFormats";
import {
  AlbumDecadeFilter,
  AlbumFormatFilter,
  AlbumGrouping,
  AlbumSortOrder,
  AlbumStatusFilter,
} from "../../types";

// Sized so the filters fit on one line on a 1280px screen. On phones, each
// group gets a full-width row of its own, which its controls share.
const useStyles = createStyles(({ responsive }) => ({
  filters: { [responsive.xs]: { width: "100%" } },
  search: { width: 220, [responsive.xs]: { flex: 1, minWidth: 0 } },
  year: { width: 110 },
  row: { [responsive.xs]: { width: "100%" } },
  sort: { width: 160, [responsive.xs]: { flex: 1, minWidth: 0 } },
  grouping: { width: 150, [responsive.xs]: { flex: 1, minWidth: 0 } },
  artist: { width: 150, [responsive.xs]: { flex: 1, minWidth: 0 } },
  status: { width: 130, [responsive.xs]: { flex: 1, minWidth: 0 } },
  // Shares its row with the count, as wide as the controls above it.
  format: { width: 130, [responsive.xs]: { width: "calc(50% - 4px)" } },
}));

// No artist goes by an empty name, so it stands for all of them.
const ALL_ARTISTS = "";

const SORT_OPTIONS: { value: AlbumSortOrder; label: string }[] = [
  { value: "title-asc", label: "Title (A-Z)" },
  { value: "title-desc", label: "Title (Z-A)" },
  { value: "artist-asc", label: "Artist (A-Z)" },
  { value: "artist-desc", label: "Artist (Z-A)" },
  { value: "year-asc", label: "Year (oldest)" },
  { value: "year-desc", label: "Year (newest)" },
  { value: "recent", label: "Recently added" },
];

const GROUPING_OPTIONS: { value: AlbumGrouping; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "artist", label: "Group by artist" },
  { value: "decade", label: "Group by decade" },
  { value: "format", label: "Group by format" },
  { value: "letter", label: "Group by letter" },
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
  grouping: AlbumGrouping;
  onGroupingChange: (grouping: AlbumGrouping) => void;
  statusFilter: AlbumStatusFilter;
  onStatusFilterChange: (statusFilter: AlbumStatusFilter) => void;
  formatFilter: AlbumFormatFilter;
  onFormatFilterChange: (formatFilter: AlbumFormatFilter) => void;
  /** Every artist in the collection, to pick from. */
  artists: string[];
  /** The artist whose albums are shown, or undefined for all of them. */
  artistFilter?: string;
  onArtistFilterChange: (artistFilter?: string) => void;
  /** The decades to filter by. No filter is shown when it's empty. */
  decades: AlbumDecadeFilter[];
  decadeFilter: AlbumDecadeFilter;
  onDecadeFilterChange: (decadeFilter: AlbumDecadeFilter) => void;
  /** How many albums match the search and filters. */
  count: number;
}

const decadeLabel = (decade: AlbumDecadeFilter) =>
  decade === "all" ? "All years" : decade === "none" ? "No year" : `${decade}s`;

export function AlbumFilters({
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  grouping,
  onGroupingChange,
  statusFilter,
  onStatusFilterChange,
  formatFilter,
  onFormatFilterChange,
  artists,
  artistFilter,
  onArtistFilterChange,
  decades,
  decadeFilter,
  onDecadeFilterChange,
  count,
}: AlbumFiltersProps) {
  const { styles } = useStyles();
  const artistOptions = [
    { value: ALL_ARTISTS, label: "All artists" },
    ...artists.map((artist) => ({ value: artist, label: artist })),
  ];
  const decadeOptions = (["all", ...decades] as AlbumDecadeFilter[]).map(
    (decade) => ({ value: decade, label: decadeLabel(decade) }),
  );

  return (
    <Flex gap="16px" wrap className={styles.filters}>
      <Flex gap="small" className={styles.row}>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by title or artist"
          allowClear
          aria-label="Search albums"
          className={styles.search}
        />
        {decades.length > 0 && (
          <Select
            value={decadeFilter}
            onChange={onDecadeFilterChange}
            options={decadeOptions}
            aria-label="Filter by year"
            className={styles.year}
          />
        )}
      </Flex>
      <Flex gap="small" className={styles.row}>
        <Select
          value={sortOrder}
          onChange={onSortOrderChange}
          options={SORT_OPTIONS}
          aria-label="Sort order"
          className={styles.sort}
        />
        <Select
          value={grouping}
          onChange={onGroupingChange}
          options={GROUPING_OPTIONS}
          aria-label="Group albums"
          className={styles.grouping}
        />
      </Flex>
      <Flex gap="small" className={styles.row}>
        <Select
          value={artistFilter ?? ALL_ARTISTS}
          onChange={(artist) => onArtistFilterChange(artist || undefined)}
          options={artistOptions}
          // Wider than the filter, so long names fit.
          popupMatchSelectWidth={240}
          aria-label="Filter by artist"
          className={styles.artist}
        />
        <Select
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={STATUS_OPTIONS}
          aria-label="Filter by status"
          className={styles.status}
        />
      </Flex>
      {/* Grouped so the count never wraps onto a line of its own. */}
      <Flex gap="small" align="center" className={styles.row}>
        <Select
          value={formatFilter}
          onChange={onFormatFilterChange}
          options={FORMAT_FILTER_OPTIONS}
          aria-label="Filter by format"
          className={styles.format}
        />
        {/* A status role, so screen readers announce the count as it changes. */}
        <Typography.Text type="secondary" role="status">
          {albumCount(count)}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}
