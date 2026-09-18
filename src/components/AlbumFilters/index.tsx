import { Flex, Input, Select } from "antd";

import { AlbumSortOrder, AlbumStatusFilter } from "../../types";

const SORT_OPTIONS: { value: AlbumSortOrder; label: string }[] = [
  { value: "title-asc", label: "Title (A–Z)" },
  { value: "title-desc", label: "Title (Z–A)" },
  { value: "artist-asc", label: "Artist (A–Z)" },
  { value: "artist-desc", label: "Artist (Z–A)" },
];

const STATUS_OPTIONS: { value: AlbumStatusFilter; label: string }[] = [
  { value: "all", label: "All albums" },
  { value: "owned", label: "Owned" },
  { value: "wishlisted", label: "Wishlisted" },
];

interface AlbumFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  sortOrder: AlbumSortOrder;
  onSortOrderChange: (sortOrder: AlbumSortOrder) => void;
  statusFilter: AlbumStatusFilter;
  onStatusFilterChange: (statusFilter: AlbumStatusFilter) => void;
}

export function AlbumFilters({
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
  statusFilter,
  onStatusFilterChange,
}: AlbumFiltersProps) {
  return (
    <Flex gap="16px" wrap>
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by title or artist"
        allowClear
        aria-label="Search albums"
        style={{ width: 280 }}
      />
      <Select
        value={sortOrder}
        onChange={onSortOrderChange}
        options={SORT_OPTIONS}
        aria-label="Sort order"
        style={{ width: 180 }}
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilterChange}
        options={STATUS_OPTIONS}
        aria-label="Filter by status"
        style={{ width: 160 }}
      />
    </Flex>
  );
}
