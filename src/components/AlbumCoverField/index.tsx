import { useEffect, useRef, useState } from "react";
import { Button, Form, Input, Space, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import { CoverResult, searchCovers } from "../../api/coverArt";
import { AlbumInput } from "../../types";
import { isHttpUrl } from "../../urls";

type CoverSearch =
  | { status: "idle" | "loading" | "error" }
  | { status: "done"; covers: CoverResult[] };

const useStyles = createStyles(({ token }) => ({
  results: {
    display: "flex",
    flexDirection: "column",
    gap: token.marginXS,
    paddingTop: token.paddingXS,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
    gap: token.marginXS,
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    gap: token.paddingXXS,
    minWidth: 0,
    padding: token.paddingXXS,
    border: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    background: "none",
    color: token.colorText,
    font: "inherit",
    fontSize: token.fontSizeSM,
    textAlign: "start",
    cursor: "pointer",
    "&:hover": { borderColor: token.colorPrimaryHover },
  },
  selected: {
    borderColor: token.colorPrimary,
    boxShadow: `0 0 0 1px ${token.colorPrimary}`,
  },
  image: {
    display: "block",
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: token.borderRadiusSM,
    // Shows while the thumbnail loads.
    background: token.colorFillTertiary,
  },
  caption: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  details: {
    color: token.colorTextSecondary,
  },
}));

async function validateCoverUrl(_: unknown, value?: string) {
  const url = value?.trim();
  if (url && !isHttpUrl(url)) {
    throw new Error("Enter a URL that starts with http:// or https://");
  }
}

/** The cover URL field, plus a picker that finds covers by title and artist. */
export function AlbumCoverField() {
  const { styles, cx } = useStyles();
  const form = Form.useFormInstance<AlbumInput>();
  const title = Form.useWatch("title", form) ?? "";
  const artist = Form.useWatch("artist", form) ?? "";
  const coverUrl = Form.useWatch("coverUrl", form);
  const [search, setSearch] = useState<CoverSearch>({ status: "idle" });
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const controllerRef = useRef<AbortController>(null);

  // Cancels a search that's still running when the modal closes.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const findCovers = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSearch({ status: "loading" });
    setFailedIds([]);
    try {
      const covers = await searchCovers(title, artist, controller.signal);
      setSearch({ status: "done", covers });
    } catch {
      if (!controller.signal.aborted) {
        setSearch({ status: "error" });
      }
    }
  };

  const pickCover = (cover: CoverResult) => {
    // setFields also clears any error left by a mistyped URL.
    form.setFields([{ name: "coverUrl", value: cover.imageUrl, errors: [] }]);
  };

  // Albums without a cover are dropped once their thumbnail fails to load.
  const covers =
    search.status === "done"
      ? search.covers.filter((cover) => !failedIds.includes(cover.id))
      : [];

  let results: React.ReactNode = null;
  if (search.status === "error") {
    results = (
      <Typography.Text type="danger">
        Couldn't reach MusicBrainz. Try again in a moment.
      </Typography.Text>
    );
  } else if (search.status === "done" && covers.length === 0) {
    results = (
      <Typography.Text type="secondary">
        No covers found. Check the title and artist, or paste a URL.
      </Typography.Text>
    );
  } else if (search.status === "done") {
    results = (
      <>
        <div className={styles.grid}>
          {covers.map((cover) => {
            const details = [cover.year, cover.artist]
              .filter(Boolean)
              .join(" · ");
            const isSelected = cover.imageUrl === coverUrl;
            return (
              <button
                key={cover.id}
                type="button"
                className={cx(styles.tile, isSelected && styles.selected)}
                aria-pressed={isSelected}
                title={details ? `${cover.title} (${details})` : cover.title}
                onClick={() => pickCover(cover)}
              >
                <img
                  className={styles.image}
                  src={cover.thumbnailUrl}
                  alt=""
                  onError={() => setFailedIds((ids) => [...ids, cover.id])}
                />
                <span className={styles.caption}>{cover.title}</span>
                <span className={cx(styles.caption, styles.details)}>
                  {details}
                </span>
              </button>
            );
          })}
        </div>
        <span>
          Covers from the{" "}
          <Typography.Link href="https://coverartarchive.org" target="_blank">
            Cover Art Archive
          </Typography.Link>
        </span>
      </>
    );
  }

  return (
    <Form.Item
      label="Cover image URL"
      htmlFor="cover-url"
      extra={results ? <div className={styles.results}>{results}</div> : null}
    >
      <Space.Compact block>
        <Form.Item
          name="coverUrl"
          noStyle
          rules={[{ validator: validateCoverUrl }]}
        >
          <Input
            id="cover-url"
            inputMode="url"
            placeholder="https://example.com/cover.jpg"
          />
        </Form.Item>
        <Button
          icon={<SearchOutlined />}
          loading={search.status === "loading"}
          disabled={!title.trim()}
          onClick={findCovers}
        >
          Find covers
        </Button>
      </Space.Compact>
    </Form.Item>
  );
}
