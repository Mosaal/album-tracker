import { Card } from "antd";
import { Album } from "../../types";

interface AlbumCardProps {
  album: Album;
}

export function AlbumCard({ album }: AlbumCardProps) {
  return (
    <Card cover={<img alt={album.title} src={album.coverUrl} />}>
      <Card.Meta title={album.title} description={album.artist} />
    </Card>
  );
}
