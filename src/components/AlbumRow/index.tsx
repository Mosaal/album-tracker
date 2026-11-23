import { useState } from "react";
import { Avatar, Card, Flex, Tag, theme, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";

import { FORMAT_LABELS } from "../../albums/albumFormats";
import { Album } from "../../types";
import { DeleteAlbumButton, EditAlbumButton } from "../AlbumActionButtons";
import { AlbumByline } from "../AlbumByline";
import { AlbumCheckbox, AlbumSelection } from "../AlbumCheckbox";
import { AlbumNotesButton } from "../AlbumNotesButton";
import { AlbumStatusSwitch } from "../AlbumStatusSwitch";
import { CoverImage } from "../CoverImage";

function AlbumThumbnail({ album }: { album: Album }) {
  const { token } = theme.useToken();
  // Tracks the URL that failed, so editing in a different one tries again.
  const [failedUrl, setFailedUrl] = useState<string>();
  const coverUrl = album.coverUrl === failedUrl ? undefined : album.coverUrl;

  return (
    <Avatar
      shape="square"
      size={64}
      icon={<PictureOutlined />}
      // antd clears the square's background behind an image, which would leave
      // it blank while the cover loads.
      style={coverUrl ? { background: token.colorTextPlaceholder } : undefined}
      // An image rather than its URL, so it only loads when scrolled near.
      src={
        coverUrl ? (
          <CoverImage
            key={coverUrl}
            src={coverUrl}
            alt={album.title}
            onError={() => setFailedUrl(coverUrl)}
          />
        ) : undefined
      }
    />
  );
}

interface AlbumRowProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onStatusChange: (album: Album, status: Album["status"]) => void;
  /** Set in selection mode, which swaps the row's buttons for a checkbox. */
  selection?: AlbumSelection;
}

export function AlbumRow({
  album,
  onEdit,
  onDelete,
  onStatusChange,
  selection,
}: AlbumRowProps) {
  const { token } = theme.useToken();

  return (
    <Card size="small">
      {selection && <AlbumCheckbox album={album} selection={selection} />}
      <Flex gap="16px" align="center">
        <AlbumThumbnail album={album} />
        <Flex vertical flex={1} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis>
            {album.title}
          </Typography.Text>
          <Typography.Text type="secondary">
            <AlbumByline album={album} />
          </Typography.Text>
          {/* As tall as a format tag even without one, so rows match. The
              tag wraps below the switch when a phone has no room for both. */}
          <Flex
            gap="small"
            align="center"
            wrap
            style={{ marginTop: 4, minHeight: token.controlHeightSM }}
            inert={Boolean(selection)}
          >
            <AlbumStatusSwitch album={album} onChange={onStatusChange} />
            {album.format && <Tag>{FORMAT_LABELS[album.format]}</Tag>}
            <AlbumNotesButton album={album} />
          </Flex>
        </Flex>
        {!selection && (
          <Flex gap="small">
            <EditAlbumButton album={album} onClick={onEdit} size="large" />
            <DeleteAlbumButton album={album} onClick={onDelete} size="large" />
          </Flex>
        )}
      </Flex>
    </Card>
  );
}
