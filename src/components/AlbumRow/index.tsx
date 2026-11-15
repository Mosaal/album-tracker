import { Avatar, Card, Flex, Tag, theme, Typography } from "antd";
import { PictureOutlined } from "@ant-design/icons";

import { FORMAT_LABELS } from "../../albumFormats";
import { Album } from "../../types";
import { DeleteAlbumButton, EditAlbumButton } from "../AlbumActionButtons";
import { AlbumCheckbox, AlbumSelection } from "../AlbumCheckbox";
import { AlbumStatusSwitch } from "../AlbumStatusSwitch";

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
        <Avatar
          shape="square"
          size={64}
          src={album.coverUrl}
          icon={<PictureOutlined />}
          alt={album.title}
        />
        <Flex vertical flex={1} style={{ minWidth: 0 }}>
          <Typography.Text strong ellipsis>
            {album.title}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis>
            {album.artist}
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
