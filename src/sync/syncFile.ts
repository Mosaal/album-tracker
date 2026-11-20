import { albumCount, isRecord, toAlbum } from "../albums/albumFiles";
import { toTimestamp } from "../albums/timestamps";
import { Album, Collection, DeletedAlbum } from "../types";

/** The file in the repository that holds the collection. */
export const SYNC_FILE_NAME = "albums.json";
const FORMAT = "album-tracker";
// Version 2 added years and notes. Earlier versions of the app would drop
// them when saving, so they refuse to sync with a newer file instead.
const VERSION = 2;

/** The file isn't one the app wrote, so it's left alone. */
export class InvalidSyncFileError extends Error {}

/** A newer version of the app wrote the file, and this one could damage it. */
export class NewerSyncFileError extends Error {}

/**
 * Some of the file's entries can't be read, perhaps after an edit on GitHub,
 * and saving over it would lose them.
 */
export class UnreadableEntriesError extends Error {
  constructor(readonly count: number) {
    super(`${count} entries in the file can't be read`);
  }
}

// A fixed order keeps each commit's diff down to what actually changed.
const ALBUM_KEYS = [
  "id",
  "title",
  "artist",
  "year",
  "format",
  "status",
  "coverUrl",
  "notes",
  "addedAt",
  "updatedAt",
] as const;

const tidy = (album: Album) =>
  Object.fromEntries(
    ALBUM_KEYS.filter((key) => album[key] !== undefined).map((key) => [
      key,
      album[key],
    ]),
  );

const oldestFirst = (a: DeletedAlbum, b: DeletedAlbum) => {
  const [first, second] = [a.deletedAt + a.id, b.deletedAt + b.id];
  return first === second ? 0 : first < second ? -1 : 1;
};

const sortedDeleted = (deleted: DeletedAlbum[]) =>
  [...deleted].sort(oldestFirst);

/**
 * The collection as the text of albums.json: the same shape as a JSON export,
 * so it can be imported too, plus the deleted albums.
 */
export function createSyncFile({ albums, deleted }: Collection) {
  const file = {
    format: FORMAT,
    version: VERSION,
    albums: albums.map(tidy),
    deleted: sortedDeleted(deleted),
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function toDeletedAlbum(value: unknown): DeletedAlbum | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
    return undefined;
  }
  const deletedAt = toTimestamp(value.deletedAt);
  return deletedAt ? { id: value.id, deletedAt } : undefined;
}

/** A 64-bit hash of the text, in hex. */
function hash(text: string) {
  let first = 0x811c9dc5;
  let second = 0x9747b28c;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x5bd1e995);
  }
  return [first, second]
    .map((part) => (part >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

/**
 * Gives an id to each album added on GitHub without one, or with an id copied
 * from an album above it. The id comes from the album's details, so every
 * device reading the file gives it the same one.
 */
function withIds(entries: unknown[]) {
  const albums: Album[] = [];
  const ids = new Set<string>();
  const copies = new Map<string, number>();
  for (const entry of entries) {
    const album = toAlbum(entry);
    if (!album) {
      continue;
    }
    if (!isRecord(entry) || entry.id !== album.id || ids.has(album.id)) {
      const details = JSON.stringify(tidy({ ...album, id: "" }));
      // Counted, so that identical albums get an id each.
      const copy = (copies.get(details) ?? 0) + 1;
      copies.set(details, copy);
      album.id = hash(`${details}\n${copy}`);
    }
    ids.add(album.id);
    albums.push(album);
  }
  return albums;
}

/**
 * Reads albums.json. Throws InvalidSyncFileError, NewerSyncFileError or
 * UnreadableEntriesError rather than risk damaging it.
 */
export function readSyncFile(text: string): Collection {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidSyncFileError();
  }
  if (
    !isRecord(data) ||
    data.format !== FORMAT ||
    !Array.isArray(data.albums) ||
    // A JSON export has no list of deleted albums.
    !(data.deleted === undefined || Array.isArray(data.deleted))
  ) {
    throw new InvalidSyncFileError();
  }
  if (typeof data.version === "number" && data.version > VERSION) {
    throw new NewerSyncFileError();
  }

  const deletedEntries: unknown[] = data.deleted ?? [];
  const albums = withIds(data.albums);
  const deleted = deletedEntries
    .map(toDeletedAlbum)
    .filter((entry) => entry !== undefined);
  const unreadable =
    data.albums.length -
    albums.length +
    (deletedEntries.length - deleted.length);
  if (unreadable > 0) {
    throw new UnreadableEntriesError(unreadable);
  }
  return { albums, deleted };
}

const name = (album: Album) => `"${album.title}" by ${album.artist}`;

const sameAlbum = (a: Album, b: Album) =>
  JSON.stringify(tidy(a)) === JSON.stringify(tidy(b));

/** Only the status changed, to `status`. */
const markedAs = (status: Album["status"], before: Album, after: Album) =>
  after.status === status &&
  before.status !== status &&
  sameAlbum({ ...before, status, updatedAt: after.updatedAt }, after);

/** Lists actions the way people say them: "a, b and c". */
const listed = (parts: string[]) =>
  parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/**
 * A commit message for the change from `before` (what the repository had, if
 * anything) to `after`, such as "Add 3 albums, edit 1 and delete 1".
 */
export function describeChanges(
  before: Collection | undefined,
  after: Collection,
) {
  if (!before) {
    return `Start syncing ${albumCount(after.albums.length)}`;
  }

  const earlier = new Map(before.albums.map((album) => [album.id, album]));
  const kept = new Set(after.albums.map((album) => album.id));
  const added = after.albums.filter((album) => !earlier.has(album.id));
  const deleted = before.albums.filter((album) => !kept.has(album.id));
  const edited = after.albums.filter((album) => {
    const old = earlier.get(album.id);
    return old !== undefined && !sameAlbum(old, album);
  });

  const [first] = edited;
  if (
    first &&
    added.length === 0 &&
    deleted.length === 0 &&
    edited.every((album) =>
      markedAs(first.status, earlier.get(album.id)!, album),
    )
  ) {
    const albums =
      edited.length === 1 ? name(first) : albumCount(edited.length);
    return `Mark ${albums} as ${first.status}`;
  }

  const changes = (
    [
      ["Add", added],
      ["Edit", edited],
      ["Delete", deleted],
    ] as const
  ).filter(([, albums]) => albums.length > 0);
  if (changes.length === 0) {
    const sameDeleted =
      JSON.stringify(sortedDeleted(before.deleted)) ===
      JSON.stringify(sortedDeleted(after.deleted));
    return sameDeleted ? "Update albums" : "Record deleted albums";
  }
  if (changes.length === 1 && changes[0][1].length === 1) {
    return `${changes[0][0]} ${name(changes[0][1][0])}`;
  }
  return listed(
    changes.map(([verb, albums], index) =>
      index === 0
        ? `${verb} ${albumCount(albums.length)}`
        : `${verb.toLowerCase()} ${albums.length}`,
    ),
  );
}
