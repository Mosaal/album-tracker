import { useState } from "react";
import { Card } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { Album } from "../../types";
import { DeleteAlbumButton, EditAlbumButton } from "../AlbumActionButtons";
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

const useCardStyles = createStyles(({ token }) => ({
  // One line, like the title, so a long artist name can't push this card's
  // switch and buttons out of line with its neighbours.
  artist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // The buttons fill the action bar edge to edge, at the bar's usual height.
  // The tripled class outweighs antd's ".ant-card .ant-card-actions > li".
  actions: { "&&& > li": { margin: 0 } },
  action: { height: 48, borderRadius: 0 },
  // Rounded to follow the card's bottom corners, just inside its border.
  firstAction: {
    borderEndStartRadius: token.borderRadiusLG - token.lineWidth,
  },
  lastAction: { borderEndEndRadius: token.borderRadiusLG - token.lineWidth },
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
  const { styles, cx } = useCardStyles();

  return (
    <Card
      cover={<AlbumCover album={album} />}
      classNames={{ actions: styles.actions }}
      actions={[
        <EditAlbumButton
          key="edit"
          album={album}
          onClick={onEdit}
          block
          className={cx(styles.action, styles.firstAction)}
        />,
        <DeleteAlbumButton
          key="delete"
          album={album}
          onClick={onDelete}
          block
          className={cx(styles.action, styles.lastAction)}
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
