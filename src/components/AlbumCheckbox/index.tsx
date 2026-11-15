import { Checkbox } from "antd";
import { createStyles } from "antd-style";

import { Album } from "../../types";

/** Whether an album is picked, in selection mode, and how to change that. */
export interface AlbumSelection {
  selected: boolean;
  onToggle: (album: Album) => void;
}

const useStyles = createStyles(({ token, prefixCls }) => ({
  // The label covers the card or row it's in, so a tap anywhere on it ticks
  // the box in the corner. Doubled to outweigh antd's checkbox label styles.
  overlay: {
    "&&": {
      position: "absolute",
      inset: 0,
      zIndex: 1,
      padding: token.paddingSM,
      borderRadius: token.borderRadiusLG,
    },
    // antd centres the box in its label.
    [`&& .${prefixCls}-checkbox`]: { alignSelf: "flex-start" },
  },
  selected: { "&&": { boxShadow: `inset 0 0 0 2px ${token.colorPrimary}` } },
}));

/** Picks an album in selection mode, from anywhere on its card or row. */
export function AlbumCheckbox({
  album,
  selection,
}: {
  album: Album;
  selection: AlbumSelection;
}) {
  const { styles, cx } = useStyles();

  return (
    <Checkbox
      className={cx(styles.overlay, selection.selected && styles.selected)}
      checked={selection.selected}
      onChange={() => selection.onToggle(album)}
      aria-label={`Select ${album.title}`}
    />
  );
}
