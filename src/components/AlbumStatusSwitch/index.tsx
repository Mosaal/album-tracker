import { Switch } from "antd";

import { Album } from "../../types";

interface AlbumStatusSwitchProps {
  album: Album;
  onChange: (album: Album, status: Album["status"]) => void;
}

/** Shows whether an album is owned or wishlisted, and flips it in one click. */
export function AlbumStatusSwitch({ album, onChange }: AlbumStatusSwitchProps) {
  return (
    <Switch
      size="small"
      checked={album.status === "owned"}
      checkedChildren="Owned"
      unCheckedChildren="Wishlisted"
      aria-label={`Owned: ${album.title}`}
      onChange={(owned) => onChange(album, owned ? "owned" : "wishlisted")}
    />
  );
}
