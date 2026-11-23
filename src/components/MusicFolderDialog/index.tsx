import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Flex,
  Form,
  Modal,
  Progress,
  Select,
  Typography,
} from "antd";
import { FolderOpenOutlined, PictureOutlined } from "@ant-design/icons";
import { createStyles } from "antd-style";

import {
  albumCount,
  FoundAlbumMatch,
  matchFoundAlbums,
} from "../../albums/albumFiles";
import { FORMAT_LABELS, FORMAT_OPTIONS } from "../../albums/albumFormats";
import { COVER_ART_URL } from "../../api/musicBrainz";
import {
  findAlbums,
  FoundAlbum,
  whyIncomplete,
} from "../../importExport/musicLibrary";
import { readTracks } from "../../importExport/musicTags";
import { Album, AlbumFormat, AlbumInput } from "../../types";
import { CoverImage } from "../CoverImage";

const useStyles = createStyles(({ token }) => ({
  list: {
    maxHeight: "min(50vh, 420px)",
    overflowY: "auto",
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
  },
  // Doubled to outweigh antd's spacing between checkboxes.
  row: {
    "&&": {
      display: "flex",
      alignItems: "center",
      margin: 0,
      padding: `${token.paddingXS}px ${token.paddingSM}px`,
      // Rows out of view skip layout and painting, which keeps a long list
      // quick to show.
      contentVisibility: "auto",
      containIntrinsicSize: "auto 64px",
    },
    "& + &": { borderTop: `1px solid ${token.colorBorderSecondary}` },
    // Lets long titles shorten with an ellipsis instead of widening the row.
    "& .ant-checkbox-label": { flex: 1, minWidth: 0 },
  },
  // Plain elements, rather than antd's, as a library can list thousands.
  album: { display: "flex", alignItems: "center", gap: token.marginXS },
  cover: {
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    overflow: "hidden",
    borderRadius: token.borderRadiusSM,
    background: token.colorFillSecondary,
    color: token.colorTextTertiary,
    fontSize: token.fontSizeLG,
    "& img": { width: "100%", height: "100%", objectFit: "cover" },
  },
  details: { display: "flex", flexDirection: "column", minWidth: 0 },
  title: {
    fontWeight: token.fontWeightStrong,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  byline: {
    color: token.colorTextSecondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  note: { color: token.colorTextSecondary },
  // A button that sits in a line of text, like a link.
  inlineButton: { "&&": { height: "auto", padding: 0 } },
}));

type RowClassNames = Pick<
  ReturnType<typeof useStyles>["styles"],
  "row" | "album" | "cover" | "details" | "title" | "byline" | "note"
>;

type Step =
  | { name: "choose"; problem?: string }
  | { name: "reading"; read: number; total: number }
  | {
      name: "review";
      found: FoundAlbum[];
      /** The music files read. */
      files: number;
      /** Files that couldn't be read, or didn't say which album they're from. */
      leftOut: number;
    };

const canPickFolders = () => "webkitdirectory" in HTMLInputElement.prototype;

/** The cover the Cover Art Archive has for a MusicBrainz release group. */
const coverOf = (releaseGroupId: string, size: 250 | 500) =>
  `${COVER_ART_URL}/${releaseGroupId}/front-${size}`;

const formatList = (formats: AlbumFormat[]) =>
  formats.map((format) => FORMAT_LABELS[format]).join(" and ");

/** What the list says about an album, besides its details. */
function noteOf(album: FoundAlbum, match: FoundAlbumMatch) {
  return [
    match.kind === "wishlisted" && "On your wishlist: will be marked owned",
    match.kind === "other-format" && `Owned as ${formatList(match.formats)}`,
    whyIncomplete(album),
    album.isNamedFromFolder && "Named after its folder",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Albums start ticked unless they look incomplete or are owned already. */
const isTickedAtFirst = (album: FoundAlbum, match: FoundAlbumMatch) =>
  (match.kind === "new" || match.kind === "wishlisted") &&
  !whyIncomplete(album);

function Cover({
  releaseGroupId,
  className,
}: {
  releaseGroupId?: string;
  className: string;
}) {
  // Tracks the URL that failed, as the Cover Art Archive lacks some covers.
  const [failedUrl, setFailedUrl] = useState<string>();
  // The smaller size, as the list shows it small.
  const thumbnail = releaseGroupId && coverOf(releaseGroupId, 250);

  return (
    <span className={className}>
      {thumbnail && thumbnail !== failedUrl ? (
        <CoverImage
          src={thumbnail}
          alt=""
          onError={() => setFailedUrl(thumbnail)}
        />
      ) : (
        // Hidden from screen readers, as each checkbox reads out its row.
        <PictureOutlined aria-hidden />
      )}
    </span>
  );
}

interface FoundAlbumRowProps {
  album: FoundAlbum;
  note: string;
  ticked: boolean;
  onToggle: (key: string) => void;
  classNames: RowClassNames;
}

// Memoised, so ticking one album doesn't render every row again.
const FoundAlbumRow = memo(function FoundAlbumRow({
  album,
  note,
  ticked,
  onToggle,
  classNames,
}: FoundAlbumRowProps) {
  const tracks =
    album.tracks === 1 ? "1 track" : `${album.tracks.toLocaleString()} tracks`;
  return (
    <Checkbox
      className={classNames.row}
      checked={ticked}
      onChange={() => onToggle(album.key)}
    >
      <span className={classNames.album}>
        <Cover
          releaseGroupId={album.releaseGroupId}
          className={classNames.cover}
        />
        <span className={classNames.details}>
          <span className={classNames.title}>{album.title}</span>
          <span className={classNames.byline}>
            {[album.artist, album.year, tracks].filter(Boolean).join(" · ")}
          </span>
          {note && <span className={classNames.note}>{note}</span>}
        </span>
      </span>
    </Checkbox>
  );
});

interface MusicFolderDialogProps {
  open: boolean;
  /** The collection, which the albums found are compared with. */
  albums: Album[];
  /**
   * Adds the albums ticked, and marks the wishlisted ones owned, with the
   * covers found for them. Throws if they can't be saved.
   */
  onImport: (
    found: Pick<AlbumInput, "title" | "artist" | "year" | "coverUrl">[],
    wishlisted: { id: string; coverUrl?: string }[],
    format: AlbumFormat,
  ) => void;
  onClose: () => void;
}

/**
 * Finds the albums in a folder of music files, by reading their tags on this
 * device, and adds the ones picked as owned, in the format chosen.
 */
export function MusicFolderDialog({
  open,
  albums,
  onImport,
  onClose,
}: MusicFolderDialogProps) {
  const { styles } = useStyles();
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [format, setFormat] = useState<AlbumFormat>();
  // The albums ticked, by key.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef<AbortController>(undefined);

  const found = useMemo(
    () => (step.name === "review" ? step.found : []),
    [step],
  );
  const matches = useMemo(
    () => (format ? matchFoundAlbums(albums, found, format) : []),
    [albums, found, format],
  );
  // Albums already owned in this format aren't listed.
  const listed = useMemo(
    () =>
      found.flatMap((album, index) =>
        matches[index] && matches[index].kind !== "owned"
          ? [{ album, match: matches[index] }]
          : [],
      ),
    [found, matches],
  );
  const tickedCount = listed.filter(({ album }) =>
    ticked.has(album.key),
  ).length;

  const toggle = useCallback(
    (key: string) =>
      setTicked((current) => {
        const next = new Set(current);
        if (!next.delete(key)) {
          next.add(key);
        }
        return next;
      }),
    [],
  );

  const chooseFolder = () => fileInput.current?.click();

  const readFiles = async (files: File[]) => {
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setStep({ name: "reading", read: 0, total: 0 });
    try {
      const result = await readTracks(files, {
        signal: controller.signal,
        onProgress: (read, total) => {
          if (!controller.signal.aborted) {
            setStep({ name: "reading", read, total });
          }
        },
      });
      const { albums: found, unplaced } = findAlbums(result.tracks);
      setFormat(undefined);
      setTicked(new Set());
      setSaveFailed(false);
      setStep(
        found.length > 0
          ? {
              name: "review",
              found,
              files: result.files,
              leftOut: result.unreadable + unplaced,
            }
          : {
              name: "choose",
              problem:
                result.files > 0
                  ? "Couldn't find any albums there: its music files don't say which album they're from."
                  : "There's no music in that folder.",
            },
      );
    } catch {
      if (!controller.signal.aborted) {
        setStep({ name: "choose", problem: "Couldn't read that folder." });
      }
    }
  };

  const stopReading = () => {
    reading.current?.abort();
    setStep({ name: "choose" });
  };

  const close = () => {
    reading.current?.abort();
    onClose();
  };

  const chooseFormat = (format: AlbumFormat) => {
    setFormat(format);
    const matches = matchFoundAlbums(albums, found, format);
    setTicked(
      new Set(
        found.flatMap((album, index) =>
          isTickedAtFirst(album, matches[index]) ? [album.key] : [],
        ),
      ),
    );
  };

  const toggleAll = () =>
    setTicked(
      tickedCount === listed.length
        ? new Set()
        : new Set(listed.map(({ album }) => album.key)),
    );

  const importTicked = () => {
    const chosen = listed.filter(({ album }) => ticked.has(album.key));
    try {
      onImport(
        chosen.flatMap(({ album, match }) =>
          match.kind === "wishlisted"
            ? []
            : [
                {
                  title: album.title,
                  artist: album.artist,
                  year: album.year,
                  coverUrl:
                    album.releaseGroupId && coverOf(album.releaseGroupId, 500),
                },
              ],
        ),
        chosen.flatMap(({ album, match }) =>
          match.kind === "wishlisted"
            ? [
                {
                  id: match.id,
                  coverUrl:
                    album.releaseGroupId && coverOf(album.releaseGroupId, 500),
                },
              ]
            : [],
        ),
        format!,
      );
    } catch {
      setSaveFailed(true);
    }
  };

  const ownedCount = found.length - listed.length;

  return (
    <Modal
      open={open}
      title="Import music folder"
      width={640}
      onCancel={close}
      afterClose={() => {
        setStep({ name: "choose" });
        setFormat(undefined);
        setTicked(new Set());
        setSaveFailed(false);
      }}
      footer={
        step.name === "review" ? (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              type="primary"
              disabled={!format || tickedCount === 0}
              onClick={importTicked}
            >
              {format && tickedCount > 0
                ? `Import ${albumCount(tickedCount)}`
                : "Import"}
            </Button>
          </>
        ) : (
          <Button onClick={step.name === "reading" ? stopReading : close}>
            Cancel
          </Button>
        )
      }
    >
      <input
        ref={(input) => {
          fileInput.current = input;
          // React doesn't know this attribute, which picks folders.
          if (input) {
            input.webkitdirectory = canPickFolders();
          }
        }}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Cleared so that choosing the same folder again still reads it.
          event.target.value = "";
          if (files.length > 0) {
            void readFiles(files);
          }
        }}
      />
      {step.name === "choose" && (
        <Flex vertical gap="middle" align="start">
          <Typography.Text>
            Add the albums in a folder of music files, such as your Music
            folder, as albums you own. Album Tracker reads the album, artist and
            year from each file's tags on this device, and doesn't upload
            anything.
          </Typography.Text>
          {canPickFolders() && (
            <Typography.Text type="secondary">
              Your browser may ask whether to upload the files. That only lets
              Album Tracker read them here.
            </Typography.Text>
          )}
          {step.problem && <Alert type="info" showIcon title={step.problem} />}
          <Button
            type="primary"
            icon={<FolderOpenOutlined />}
            onClick={chooseFolder}
          >
            {canPickFolders() ? "Choose folder" : "Choose files"}
          </Button>
        </Flex>
      )}
      {step.name === "reading" && (
        <Flex vertical gap="small">
          <Typography.Text>
            {step.total > 0
              ? `Reading ${step.read.toLocaleString()} of ${step.total.toLocaleString()} ${step.total === 1 ? "file" : "files"}…`
              : "Looking for music files…"}
          </Typography.Text>
          <Progress
            percent={step.total > 0 ? (step.read / step.total) * 100 : 0}
            showInfo={false}
            aria-label="Reading files"
          />
        </Flex>
      )}
      {step.name === "review" && (
        <Flex vertical gap="middle">
          <Flex vertical>
            <Typography.Text>
              Found {albumCount(found.length)} in{" "}
              {step.files === 1
                ? "1 music file"
                : `${step.files.toLocaleString()} music files`}
              .{" "}
              <Button
                type="link"
                className={styles.inlineButton}
                onClick={chooseFolder}
              >
                {canPickFolders() ? "Choose another folder" : "Choose others"}
              </Button>
            </Typography.Text>
            {step.leftOut > 0 && (
              <Typography.Text type="secondary">
                {step.leftOut === 1
                  ? "Left out 1 file that couldn't be read or doesn't say which album it's from."
                  : `Left out ${step.leftOut.toLocaleString()} files that couldn't be read or don't say which album they're from.`}
              </Typography.Text>
            )}
          </Flex>
          <Form layout="vertical" component="div">
            <Form.Item
              label="Mark all as"
              htmlFor="music-folder-format"
              extra="The albums you import get this format."
              style={{ marginBottom: 0 }}
            >
              <Select
                id="music-folder-format"
                options={FORMAT_OPTIONS}
                value={format}
                onChange={chooseFormat}
                placeholder="Choose a format"
              />
            </Form.Item>
          </Form>
          {format &&
            (listed.length > 0 ? (
              <Flex vertical gap="small">
                {ownedCount > 0 && (
                  <Typography.Text type="secondary">
                    {albumCount(ownedCount)} already in your collection{" "}
                    {ownedCount === 1 ? "isn't" : "aren't"} listed.
                  </Typography.Text>
                )}
                <Checkbox
                  checked={tickedCount > 0 && tickedCount === listed.length}
                  indeterminate={tickedCount > 0 && tickedCount < listed.length}
                  onChange={toggleAll}
                >
                  Select all
                </Checkbox>
                <div className={styles.list}>
                  {listed.map(({ album, match }) => (
                    <FoundAlbumRow
                      key={album.key}
                      album={album}
                      note={noteOf(album, match)}
                      ticked={ticked.has(album.key)}
                      onToggle={toggle}
                      classNames={styles}
                    />
                  ))}
                </div>
              </Flex>
            ) : (
              <Typography.Text>
                They're all in your collection already.
              </Typography.Text>
            ))}
          {saveFailed && (
            <Alert
              type="error"
              showIcon
              title="Couldn't save the albums. The browser's storage may be full."
            />
          )}
        </Flex>
      )}
    </Modal>
  );
}
