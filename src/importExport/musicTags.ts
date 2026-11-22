import type { ICommonTagsResult } from "music-metadata";

import { toYear } from "../albums/albumYears";

/** What an audio file's tags say about the album it's from. */
export interface Track {
  /** The folders it's in, below the folder chosen. */
  folders: string[];
  album?: string;
  albumArtist?: string;
  artist?: string;
  /** The year the album first came out, as MusicBrainz Picard tags it. */
  originalYear?: number;
  /** The year of this release, which may be a reissue's. */
  year?: number;
  /** MusicBrainz's id for the album, whichever release of it this is. */
  releaseGroupId?: string;
  compilation: boolean;
  disc?: number;
  track?: number;
  /** How many tracks its disc has. */
  tracksOnDisc?: number;
  /** Like "album", "single" or "compilation", the main type first. */
  releaseTypes: string[];
}

export interface ReadResult {
  tracks: Track[];
  /** The music files found, including those that couldn't be read. */
  files: number;
  /** Music files whose tags couldn't be read. */
  unreadable: number;
}

interface ReadOptions {
  /** Called as files are read, a few times a second at most. */
  onProgress?: (read: number, total: number) => void;
  signal?: AbortSignal;
}

// .m4b, for audiobooks, and video files are left out on purpose.
const MUSIC_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "m4p",
  "aac",
  "flac",
  "ogg",
  "oga",
  "opus",
  "wav",
  "aif",
  "aiff",
  "aifc",
  "wma",
  "ape",
  "wv",
  "mpc",
  "dsf",
  "dff",
]);

// iTunes' media kinds for audiobooks and podcasts.
const SPOKEN_MEDIA_KINDS = [2, 21];
const SPOKEN_GENRES = /^(audio ?books?|podcasts?)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Hidden files and folders, like ".Trashes" or the "._" copies macOS leaves
// on other drives. "...And Justice for All" and ".5: The Gray Chapter" are
// albums.
const HIDDEN = /^\.[^.\d]/;
const READ_AT_ONCE = 4;
const PROGRESS_EVERY_MS = 100;

const text = (value?: string) => value?.trim() || undefined;

const isSpokenWord = (common: ICommonTagsResult) =>
  common.podcast === true ||
  SPOKEN_MEDIA_KINDS.includes(common.stik ?? 0) ||
  (common.genre ?? []).some((genre) => SPOKEN_GENRES.test(genre.trim()));

/**
 * What a file's tags say about its album, or undefined for audiobooks and
 * podcasts.
 */
export function toTrack(
  folders: string[],
  common: ICommonTagsResult,
): Track | undefined {
  if (isSpokenWord(common)) {
    return undefined;
  }
  const releaseGroupId = text(common.musicbrainz_releasegroupid);
  return {
    folders,
    album: text(common.album),
    albumArtist: text(common.albumartist),
    artist: text(common.artist),
    originalYear: toYear(common.originalyear) ?? toYear(common.originaldate),
    year: toYear(common.year) ?? toYear(common.date),
    releaseGroupId:
      releaseGroupId && UUID.test(releaseGroupId)
        ? releaseGroupId.toLowerCase()
        : undefined,
    compilation: common.compilation === true,
    disc: common.disk?.no ?? undefined,
    track: common.track?.no ?? undefined,
    tracksOnDisc: common.track?.of ?? undefined,
    releaseTypes: (common.releasetype ?? []).map((type) =>
      type.trim().toLowerCase(),
    ),
  };
}

const isHidden = (name: string) => HIDDEN.test(name);

/** The music file's folders below the one chosen, unless it's to be skipped. */
function foldersOf(file: File) {
  // Files picked one by one, rather than in a folder, have no path.
  const path = (file.webkitRelativePath || file.name).split("/");
  const name = path[path.length - 1];
  const folders = path.slice(1, -1);
  const extension = name.includes(".")
    ? name.split(".").pop()!.toLowerCase()
    : "";
  return MUSIC_EXTENSIONS.has(extension) && ![...folders, name].some(isHidden)
    ? folders
    : undefined;
}

/**
 * Reads the tags of the music files among those given, on this device, a few
 * at a time. Hidden files, files that aren't music, audiobooks and podcasts
 * are left out. Only the tags are read, not the audio or the cover art.
 */
export async function readTracks(
  files: File[],
  { onProgress, signal }: ReadOptions = {},
): Promise<ReadResult> {
  const music = files.flatMap((file) => {
    const folders = foldersOf(file);
    return folders ? [{ file, folders }] : [];
  });
  onProgress?.(0, music.length);
  // Loaded when first needed, so it isn't part of the app's main bundle.
  const { parseBlob } = await import("music-metadata");
  // By file, so the order doesn't depend on which file was read first.
  const tracks: (Track | undefined)[] = [];
  let unreadable = 0;
  let next = 0;
  let read = 0;
  let reportedAt = performance.now();

  const readFiles = async () => {
    while (next < music.length) {
      signal?.throwIfAborted();
      const index = next++;
      const { file, folders } = music[index];
      try {
        const { common } = await parseBlob(file, {
          skipCovers: true,
          skipPostHeaders: true,
        });
        tracks[index] = toTrack(folders, common);
      } catch {
        unreadable += 1;
      }
      read += 1;
      if (performance.now() - reportedAt >= PROGRESS_EVERY_MS) {
        reportedAt = performance.now();
        onProgress?.(read, music.length);
      }
    }
  };

  await Promise.all(Array.from({ length: READ_AT_ONCE }, readFiles));
  signal?.throwIfAborted();
  onProgress?.(music.length, music.length);
  return {
    tracks: tracks.filter((track) => track !== undefined),
    files: music.length,
    unreadable,
  };
}
