import { Button, Dropdown, Flex, Typography } from "antd";
import { CloseOutlined, DownOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { albumCount } from "../../albums/albumFiles";
import { FORMAT_OPTIONS } from "../../albums/albumFormats";
import { AlbumFormat } from "../../types";

const useStyles = createStyles(({ token, responsive }) => ({
  // Stays in view while scrolling through a long collection.
  bar: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    padding: token.paddingXS,
    paddingInlineEnd: token.paddingSM,
    background: token.colorBgElevated,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    boxShadow: token.boxShadowTertiary,
    [responsive.xs]: { paddingInlineEnd: token.paddingXS },
  },
  // On phones, the count and the actions get a full-width row each.
  group: { [responsive.xs]: { width: "100%" } },
  // On phones, the actions fill two even rows of two. Narrower padding lets
  // the longest labels fit. Doubled to outweigh antd's button padding.
  actions: {
    [responsive.xs]: {
      "&& > *": {
        // Half the row each, less half of the small gap between them.
        flex: `1 1 calc(50% - ${token.paddingXS / 2}px)`,
        paddingInline: token.paddingXS,
      },
    },
  },
}));

interface SelectionBarProps {
  /** How many of the albums shown are selected. */
  count: number;
  /** Whether every album shown is selected. */
  allSelected: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onMarkOwned: () => void;
  onMarkWishlisted: () => void;
  onSetFormat: (format: AlbumFormat) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** What can be done with the albums picked in selection mode. */
export function SelectionBar({
  count,
  allSelected,
  onSelectAll,
  onDeselectAll,
  onMarkOwned,
  onMarkWishlisted,
  onSetFormat,
  onDelete,
  onClose,
}: SelectionBarProps) {
  const { styles, cx } = useStyles();

  return (
    <Flex
      justify="space-between"
      align="center"
      gap="small"
      wrap
      className={styles.bar}
    >
      <Flex align="center" gap="small" className={styles.group}>
        <Button
          type="text"
          icon={<CloseOutlined />}
          aria-label="Stop selecting"
          onClick={onClose}
        />
        {/* A status role, so screen readers announce the count as it changes. */}
        <Typography.Text strong role="status">
          {albumCount(count)} selected
        </Typography.Text>
        <Button type="link" onClick={allSelected ? onDeselectAll : onSelectAll}>
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
      </Flex>
      <Flex gap="small" wrap className={cx(styles.group, styles.actions)}>
        <Button disabled={count === 0} onClick={onMarkOwned}>
          Mark owned
        </Button>
        <Button disabled={count === 0} onClick={onMarkWishlisted}>
          Mark wishlisted
        </Button>
        <Dropdown
          trigger={["click"]}
          disabled={count === 0}
          menu={{
            items: FORMAT_OPTIONS.map(({ value, label }) => ({
              key: value,
              label,
            })),
            onClick: ({ key }) => onSetFormat(key as AlbumFormat),
          }}
        >
          <Button
            disabled={count === 0}
            icon={<DownOutlined />}
            iconPlacement="end"
          >
            Set format
          </Button>
        </Dropdown>
        <Button danger disabled={count === 0} onClick={onDelete}>
          Delete
        </Button>
      </Flex>
    </Flex>
  );
}
