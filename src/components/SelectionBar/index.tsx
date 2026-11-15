import { Button, Flex, Typography } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { albumCount } from "../../albumFiles";

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
  // Narrower padding lets the three actions share a phone's row, which they
  // then fill. Doubled to outweigh antd's button padding.
  actions: {
    [responsive.xs]: {
      "&& > *": { flex: "1 1 auto", paddingInline: token.paddingXS },
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
        <Button danger disabled={count === 0} onClick={onDelete}>
          Delete
        </Button>
      </Flex>
    </Flex>
  );
}
