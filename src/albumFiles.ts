import { toFormat } from "./albumFormats";
import { toYear } from "./albumYears";
import { toTimestamp } from "./timestamps";
import { Album, AlbumFormat, AlbumInput } from "./types";
import { isHttpUrl } from "./urls";

export interface ImportSummary {
  added: number;
  /** Albums already in the collection. */
  skipped: number;
  /** Entries without a title, artist or valid status. */
  unreadable: number;
}

export const albumCount = (count: number) =>
  `${count} album${count === 1 ? "" : "s"}`;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFilled = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/** Checks and tidies up an album read from a file; undefined if it's unusable. */
export function toAlbum(value: unknown): Album | undefined {
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
  const format = toFormat(value.format);
  if (format) {
    album.format = format;
  }
  const year = toYear(value.year);
  if (year) {
    album.year = year;
  }
  if (isFilled(value.notes)) {
    album.notes = value.notes.trim();
  }
  const addedAt = toTimestamp(value.addedAt);
  if (addedAt) {
    album.addedAt = addedAt;
  }
  const updatedAt = toTimestamp(value.updatedAt);
  if (updatedAt) {
    album.updatedAt = updatedAt;
  }
  return album;
}

/** Title and artist, ignoring case and surrounding spaces. */
const titleAndArtist = (album: Pick<AlbumInput, "title" | "artist">) =>
  `${album.title.trim().toLowerCase()}\n${album.artist.trim().toLowerCase()}`;

/** Formats only tell two copies of an album apart when both are known. */
const formatsMatch = (a?: AlbumFormat, b?: AlbumFormat) => !a || !b || a === b;

/**
 * The album in the collection that this one would duplicate, if any: same
 * title, artist and format. The album being edited, by id, doesn't count.
 */
export function findDuplicate(
  albums: Album[],
  input: Pick<AlbumInput, "title" | "artist" | "format">,
  editingId?: string,
) {
  if (!input.title.trim() || !input.artist.trim()) {
    return undefined;
  }
  const key = titleAndArtist(input);
  return albums.find(
    (album) =>
      album.id !== editingId &&
      titleAndArtist(album) === key &&
      formatsMatch(album.format, input.format),
  );
}

/**
 * Adds the imported albums that aren't in the collection yet, matching on id
 * or on title, artist and format. Existing albums are never removed or changed.
 */
export function mergeAlbums(existing: Album[], imported: Album[]) {
  const ids = new Set(existing.map((album) => album.id));
  const formats = new Map<string, (AlbumFormat | undefined)[]>();
  const remember = (album: Album) => {
    const key = titleAndArtist(album);
    formats.set(key, [...(formats.get(key) ?? []), album.format]);
  };
  existing.forEach(remember);
  const added: Album[] = [];

  for (const album of imported) {
    const isKnown =
      ids.has(album.id) ||
      (formats.get(titleAndArtist(album)) ?? []).some((format) =>
        formatsMatch(format, album.format),
      );
    if (!isKnown) {
      ids.add(album.id);
      remember(album);
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
