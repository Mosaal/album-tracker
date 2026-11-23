import { memo, useState } from "react";
import { Card, Flex, Tag } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { FORMAT_LABELS } from "../../albums/albumFormats";
import { Album } from "../../types";
import { DeleteAlbumButton, EditAlbumButton } from "../AlbumActionButtons";
import { AlbumByline } from "../AlbumByline";
import { AlbumCheckbox, AlbumSelection } from "../AlbumCheckbox";
import { AlbumNotesButton } from "../AlbumNotesButton";
import { AlbumStatusSwitch } from "../AlbumStatusSwitch";
import { CoverImage } from "../CoverImage";

const useCoverStyles = createStyles(({ token }) => ({
  // A tinted square, which shows while the cover loads or if there's none.
  frame: {
    aspectRatio: "1 / 1",
    overflow: "hidden",
    alignContent: "center",
    textAlign: "center",
    fontSize: token.fontSizeHeading1,
    color: token.colorTextQuaternary,
    background: token.colorFillTertiary,
  },
  image: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
}));

const useCardStyles = createStyles(({ token }) => ({
  // Fills its grid row with the buttons along the bottom, so a card whose
  // status line wraps can't leave its neighbours' buttons out of line.
  card: { display: "flex", flexDirection: "column" },
  body: { flex: 1 },
  // As tall as a format tag even without one, so cards without one line up.
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
  const { coverUrl } = album;

  return (
    <div className={styles.frame}>
      {coverUrl && coverUrl !== failedUrl ? (
        <CoverImage
          key={coverUrl}
          className={styles.image}
          alt={album.title}
          src={coverUrl}
          onError={() => setFailedUrl(coverUrl)}
        />
      ) : (
        <PictureOutlined />
      )}
    </div>
  );
}

interface AlbumCardProps {
  album: Album;
  /** In the compact grid, where the details get less room around them. */
  compact?: boolean;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onStatusChange: (album: Album, status: Album["status"]) => void;
  /**
   * Whether the album is picked, set only in selection mode, which swaps the
   * card's buttons for a checkbox.
   */
  selected?: boolean;
  onToggleSelected: (album: Album) => void;
}

// Memoised, so a change to one album, or to the page around them, doesn't
// render every card again.
export const AlbumCard = memo(function AlbumCard({
  album,
  compact,
  onEdit,
  onDelete,
  onStatusChange,
  selected,
  onToggleSelected,
}: AlbumCardProps) {
  const { styles, cx } = useCardStyles();
  const selection: AlbumSelection | undefined =
    selected === undefined
      ? undefined
      : { selected, onToggle: onToggleSelected };

  return (
    <Card
      cover={<AlbumCover album={album} />}
      // antd's small size halves the padding around the details, and changes
      // nothing else on a card without a header.
      size={compact ? "small" : undefined}
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
        description={<AlbumByline album={album} />}
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
        <AlbumNotesButton album={album} />
      </Flex>
    </Card>
  );
});
