import { Button, Popover } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { Album } from "../../types";

const useStyles = createStyles(() => ({
  // Keeps the notes' line breaks, and stops long words overflowing.
  notes: { maxWidth: 280, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
}));

/** Shows an album's notes when clicked. Nothing for an album without any. */
export function AlbumNotesButton({ album }: { album: Album }) {
  const { styles } = useStyles();
  if (!album.notes) {
    return null;
  }
  return (
    <Popover
      content={<div className={styles.notes}>{album.notes}</div>}
      trigger="click"
    >
      <Button
        type="text"
        size="small"
        icon={<FileTextOutlined />}
        aria-label={`Notes on ${album.title}`}
      />
    </Popover>
  );
}
