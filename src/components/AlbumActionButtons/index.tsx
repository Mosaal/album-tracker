import { Button, theme } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";

import { Album } from "../../types";

interface AlbumActionButtonProps {
  album: Album;
  onClick: (album: Album) => void;
  /** Fills the width it's given. */
  block?: boolean;
  className?: string;
}

// Tinted buttons. antd colours their icons with the same blue and red as solid
// buttons, which are too dark to see on the tinted background in dark mode;
// the link and error text colours read well in both themes.

export function EditAlbumButton({
  album,
  onClick,
  block,
  className,
}: AlbumActionButtonProps) {
  const { token } = theme.useToken();

  return (
    <Button
      color="primary"
      variant="filled"
      block={block}
      icon={<EditOutlined />}
      aria-label={`Edit ${album.title}`}
      className={className}
      style={{ color: token.colorLink }}
      onClick={() => onClick(album)}
    />
  );
}

export function DeleteAlbumButton({
  album,
  onClick,
  block,
  className,
}: AlbumActionButtonProps) {
  const { token } = theme.useToken();

  return (
    <Button
      color="danger"
      variant="filled"
      block={block}
      icon={<DeleteOutlined />}
      aria-label={`Delete ${album.title}`}
      className={className}
      style={{ color: token.colorErrorText }}
      onClick={() => onClick(album)}
    />
  );
}
