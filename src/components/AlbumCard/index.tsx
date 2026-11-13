import { useState } from "react";
import { Button, Card } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { createStyles } from "antd-style";

import { Album } from "../../types";
import { AlbumStatusSwitch } from "../AlbumStatusSwitch";

const useCoverStyles = createStyles(({ token }) => ({
  image: {
    aspectRatio: "1 / 1",
    objectFit: "cover",
  },
  placeholder: {
    aspectRatio: "1 / 1",
    alignContent: "center",
    textAlign: "center",
    fontSize: token.fontSizeHeading1,
    color: token.colorTextQuaternary,
    background: token.colorFillTertiary,
  },
}));

const useCardStyles = createStyles(() => ({
  // One line, like the title, so a long artist name can't push this card's
  // switch and buttons out of line with its neighbours.
  artist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}));

function AlbumCover({ album }: { album: Album }) {
  const { styles } = useCoverStyles();
  // Tracks the URL that failed, so editing in a different one tries again.
  const [failedUrl, setFailedUrl] = useState<string>();

  if (!album.coverUrl || album.coverUrl === failedUrl) {
    return (
      <div className={styles.placeholder}>
        <PictureOutlined />
      </div>
    );
  }

  return (
    <img
      className={styles.image}
      alt={album.title}
      src={album.coverUrl}
      onError={() => setFailedUrl(album.coverUrl)}
    />
  );
}

interface AlbumCardProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onStatusChange: (album: Album, status: Album["status"]) => void;
}

export function AlbumCard({
  album,
  onEdit,
  onDelete,
  onStatusChange,
}: AlbumCardProps) {
  const { styles } = useCardStyles();

  return (
    <Card
      cover={<AlbumCover album={album} />}
      actions={[
        <Button
          key="edit"
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={`Edit ${album.title}`}
          onClick={() => onEdit(album)}
        />,
        <Button
          key="delete"
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          aria-label={`Delete ${album.title}`}
          onClick={() => onDelete(album)}
        />,
      ]}
    >
      <Card.Meta
        title={album.title}
        description={<div className={styles.artist}>{album.artist}</div>}
      />
      <AlbumStatusSwitch
        album={album}
        onChange={onStatusChange}
        style={{ marginTop: 12 }}
      />
    </Card>
  );
}
