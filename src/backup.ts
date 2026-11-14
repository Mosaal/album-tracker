import { Album } from "./types";
import { isHttpUrl } from "./urls";

const FORMAT = "album-tracker";

export class InvalidBackupError extends Error {
  constructor() {
    super("That file isn't an Album Tracker backup.");
  }
}

export interface ImportSummary {
  added: number;
  /** Albums already in the collection. */
  skipped: number;
  /** Entries without a title, artist or valid status. */
  unreadable: number;
}

export const albumCount = (count: number) =>
  `${count} album${count === 1 ? "" : "s"}`;

/** The contents of a backup file holding the whole collection. */
export function createBackup(albums: Album[], exportedAt = new Date()) {
  return JSON.stringify(
    {
      format: FORMAT,
      version: 1,
      exportedAt: exportedAt.toISOString(),
      albums,
    },
    null,
    2,
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFilled = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

function toAlbum(value: unknown): Album | undefined {
  if (
    !isRecord(value) ||
    !isFilled(value.title) ||
    !isFilled(value.artist) ||
    (value.status !== "owned" && value.status !== "wishlisted")
  ) {
    return undefined;
  }

  const album: Album = {
    id: isFilled(value.id) ? value.id : crypto.randomUUID(),
    title: value.title.trim(),
    artist: value.artist.trim(),
    status: value.status,
  };
  if (isFilled(value.coverUrl) && isHttpUrl(value.coverUrl.trim())) {
    album.coverUrl = value.coverUrl.trim();
  }
  return album;
}

/** Reads a backup file. Throws InvalidBackupError for anything else. */
export function readBackup(text: string) {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidBackupError();
  }
  if (
    !isRecord(data) ||
    data.format !== FORMAT ||
    !Array.isArray(data.albums)
  ) {
    throw new InvalidBackupError();
  }

  const albums = data.albums
    .map(toAlbum)
    .filter((album) => album !== undefined);
  return { albums, unreadable: data.albums.length - albums.length };
}

const sameAlbumKey = (album: Album) =>
  `${album.title.trim().toLowerCase()}\n${album.artist.trim().toLowerCase()}`;

/**
 * Adds the imported albums that aren't in the collection yet, matching on id
 * or on title and artist. Existing albums are never removed or changed.
 */
export function mergeAlbums(existing: Album[], imported: Album[]) {
  const ids = new Set(existing.map((album) => album.id));
  const keys = new Set(existing.map(sameAlbumKey));
  const added: Album[] = [];

  for (const album of imported) {
    const key = sameAlbumKey(album);
    if (!ids.has(album.id) && !keys.has(key)) {
      ids.add(album.id);
      keys.add(key);
      added.push(album);
    }
  }

  return {
    albums: [...existing, ...added],
    added: added.length,
    skipped: imported.length - added.length,
  };
}

export function describeImport({ added, skipped, unreadable }: ImportSummary) {
  const headline =
    added > 0 ? `Imported ${albumCount(added)}.` : "No new albums to import.";
  const notes = [
    skipped > 0 && `${skipped} already in your collection`,
    unreadable > 0 && `${unreadable} that couldn't be read`,
  ].filter(Boolean);

  return notes.length > 0
    ? `${headline} Skipped ${notes.join(" and ")}.`
    : headline;
}
