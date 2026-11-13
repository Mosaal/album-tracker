import { Avatar, Card, Flex, Typography } from "antd";

import { Album } from "../../types";

interface AlbumRowProps {
  album: Album;
}

export function AlbumRow({ album }: AlbumRowProps) {
  return (
    <Card size="small">
      <Flex gap="16px" align="center">
        <Avatar
          shape="square"
          size={64}
          src={album.coverUrl}
          alt={album.title}
        />
        <Flex vertical>
          <Typography.Text strong>{album.title}</Typography.Text>
          <Typography.Text type="secondary">{album.artist}</Typography.Text>
        </Flex>
      </Flex>
    </Card>
  );
}
