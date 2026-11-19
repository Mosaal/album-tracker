import { useState } from "react";
import { Card, Flex, Tag } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { FORMAT_LABELS } from "../../albumFormats";
import { Album } from "../../types";
import { DeleteAlbumButton, EditAlbumButton } from "../AlbumActionButtons";
import { AlbumCheckbox, AlbumSelection } from "../AlbumCheckbox";
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
  // Fills its grid row with the buttons along the bottom, so a card whose
  // status line wraps can't leave its neighbours' buttons out of line.
  card: { display: "flex", flexDirection: "column" },
  body: { flex: 1 },
  // One line, like the title, so a long artist name can't push this card's
  // switch and buttons out of line with its neighbours.
  artist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // As tall as a format tag even without one, for the same reason.
  statusLine: { marginTop: 12, minHeight: token.controlHeightSM },
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
      loading="lazy"
      onError={() => setFailedUrl(album.coverUrl)}
    />
  );
}

interface AlbumCardProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onStatusChange: (album: Album, status: Album["status"]) => void;
  /** Set in selection mode, which swaps the card's buttons for a checkbox. */
  selection?: AlbumSelection;
}

export function AlbumCard({
  album,
  onEdit,
  onDelete,
  onStatusChange,
  selection,
}: AlbumCardProps) {
  const { styles, cx } = useCardStyles();

  return (
    <Card
      cover={<AlbumCover album={album} />}
      className={styles.card}
      classNames={{ body: styles.body, actions: styles.actions }}
      actions={
        selection
          ? undefined
          : [
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
            ]
      }
    >
      {selection && <AlbumCheckbox album={album} selection={selection} />}
      <Card.Meta
        title={album.title}
        description={<div className={styles.artist}>{album.artist}</div>}
      />
      <Flex
        gap="small"
        align="center"
        wrap
        className={styles.statusLine}
        inert={Boolean(selection)}
      >
        <AlbumStatusSwitch album={album} onChange={onStatusChange} />
        {album.format && <Tag>{FORMAT_LABELS[album.format]}</Tag>}
      </Flex>
    </Card>
  );
}
