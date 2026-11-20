import { createStyles } from "antd-style";

import { Album } from "../../types";

const useStyles = createStyles(() => ({
  byline: { display: "flex", minWidth: 0 },
  // One line, so a long artist name can't push the rest of a card or row out
  // of line with its neighbours. The name gives way before the year does.
  artist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  year: { flexShrink: 0, whiteSpace: "pre" },
}));

/** The artist, then the year if it's known: "Miles Davis · 1959". */
export function AlbumByline({ album }: { album: Album }) {
  const { styles } = useStyles();
  return (
    <span className={styles.byline}>
      <span className={styles.artist}>{album.artist}</span>
      {album.year && <span className={styles.year}> · {album.year}</span>}
    </span>
  );
}
