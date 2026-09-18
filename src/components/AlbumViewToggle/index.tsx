import { Segmented } from "antd";

import { AlbumViewMode } from "../../types";

const VIEW_OPTIONS: { value: AlbumViewMode; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
];

interface AlbumViewToggleProps {
  viewMode: AlbumViewMode;
  onViewModeChange: (viewMode: AlbumViewMode) => void;
}

export function AlbumViewToggle({
  viewMode,
  onViewModeChange,
}: AlbumViewToggleProps) {
  return (
    <Segmented<AlbumViewMode>
      value={viewMode}
      onChange={onViewModeChange}
      options={VIEW_OPTIONS}
      aria-label="View mode"
    />
  );
}
