import { Avatar, Button, Card, Flex, Typography } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PictureOutlined,
} from "@ant-design/icons";

import { Album } from "../../types";
import { AlbumStatusSwitch } from "../AlbumStatusSwitch";

interface AlbumRowProps {
  album: Album;
  onEdit: (album: Album) => void;
  onDelete: (album: Album) => void;
  onStatusChange: (album: Album, status: Album["status"]) => void;
}

export function AlbumRow({
  album,
  onEdit,
  onDelete,
  onStatusChange,
}: AlbumRowProps) {
  return (
    <Card size="small">
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
          <AlbumStatusSwitch
            album={album}
            onChange={onStatusChange}
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          />
        </Flex>
        <Flex gap="4px">
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={`Edit ${album.title}`}
            onClick={() => onEdit(album)}
          />
          <Button
            type="text"
            icon={<DeleteOutlined />}
            aria-label={`Delete ${album.title}`}
            onClick={() => onDelete(album)}
          />
        </Flex>
      </Flex>
    </Card>
  );
}
