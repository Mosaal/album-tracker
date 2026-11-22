import { Flex, Typography } from "antd";
import { createStyles } from "antd-style";

import { albumCount } from "../../albums/albumFiles";

const useStyles = createStyles(({ token }) => ({
  heading: { marginBottom: token.marginSM },
}));

interface AlbumSectionProps {
  /** Its heading, like an artist or a decade. */
  title: string;
  /** How many albums are in it. */
  count: number;
  children: React.ReactNode;
}

/** Albums under a heading, like an artist's when grouping by artist. */
export function AlbumSection({ title, count, children }: AlbumSectionProps) {
  const { styles } = useStyles();

  return (
    <section>
      <Flex align="baseline" gap="small" className={styles.heading}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        <Typography.Text type="secondary">{albumCount(count)}</Typography.Text>
      </Flex>
      {children}
    </section>
  );
}
