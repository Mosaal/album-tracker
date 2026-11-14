import { isRecord, toAlbum } from "./albumFiles";
import { Album } from "./types";

const FORMAT = "album-tracker";

export class InvalidJsonError extends Error {
  constructor() {
    super("That isn't a JSON file from Album Tracker.");
  }
}

/** The whole collection as JSON, keeping everything about each album. */
export function createJson(albums: Album[], exportedAt = new Date()) {
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

/** Reads a JSON file from the app. Throws InvalidJsonError for anything else. */
export function readJson(text: string) {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
  if (
    !isRecord(data) ||
    data.format !== FORMAT ||
    !Array.isArray(data.albums)
  ) {
    throw new InvalidJsonError();
  }

  const albums = data.albums
    .map(toAlbum)
    .filter((album) => album !== undefined);
  return { albums, unreadable: data.albums.length - albums.length };
}
