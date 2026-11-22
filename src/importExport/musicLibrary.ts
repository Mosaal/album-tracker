import { toYear } from "../albums/albumYears";
import { Track } from "./musicTags";

/** An album found in a music folder. */
export interface FoundAlbum {
  /** Its artist and title as compared, which tell found albums apart. */
  key: string;
  title: string;
  artist: string;
  year?: number;
  /** MusicBrainz's id for it, which its cover can be found by. */
  releaseGroupId?: string;
  /** How many of its tracks were found. */
  tracks: number;
  /** How many tracks it has, when the tags of every disc found say. */
  totalTracks?: number;
  /** Whether MusicBrainz Picard tagged it as a single. */
  isSingle: boolean;
  /** Its files have no album name, so its title comes from their folder. */
  isNamedFromFolder: boolean;
}

export const VARIOUS_ARTISTS = "Various Artists";

// Folders like "CD1", "CD 2" or "Disc 02", and titles ending "(Disc 1)",
// "[CD 2]", "- Disc 2", "CD1" or "(Disk 2 of 2)".
const DISC_FOLDER = /^(?:cd|dis[ck])[\s._-]*\d+\b/i;
const DISC_SUFFIX =
  /\s*[-–:,]?\s*[([]?\s*\b(?:cd|dis[ck])\s*\d+(?:\s*(?:of|\/)\s*\d+)?\s*[)\]]?\s*$/i;
const FEATURING = /\s*[([]?\s*\b(?:feat\.?|ft\.?|featuring)\s.*$/i;
// Names that taggers and players give files they know nothing about.
const UNKNOWN = /^unknown( (artist|album))?$/i;

/** Compared in any case, without spaces around it. */
const keyOf = (name: string) => name.trim().toLowerCase();

const known = (name?: string) =>
  name && !UNKNOWN.test(name.trim()) ? name.trim() : undefined;

const withoutDisc = (title: string) =>
  title.replace(DISC_SUFFIX, "").trim() || title.trim();

/** The main artist of "Drake feat. Rihanna". */
const mainArtist = (artist: string) =>
  artist.replace(FEATURING, "").trim() || artist.trim();

/** The most common of the values, the first one seen if they tie. */
function mostCommon<T>(values: T[], key: (value: T) => string = String) {
  const counts = new Map<string, { value: T; count: number }>();
  for (const value of values) {
    const entry = counts.get(key(value)) ?? { value, count: 0 };
    entry.count += 1;
    counts.set(key(value), entry);
  }
  let best: { value: T; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) {
      best = entry;
    }
  }
  return best;
}

/** The most common year, the earliest if they tie. */
const commonYear = (years: (number | undefined)[]) =>
  mostCommon(years.filter((year) => year !== undefined).sort((a, b) => a - b))
    ?.value;

/**
 * An album folder's name, like "Radiohead - OK Computer (1997)",
 * "1997 - OK Computer" or just "OK Computer".
 */
function readFolderName(name: string) {
  let rest = name.trim();
  let year: number | undefined;
  const bracketedYear = /^(.+?)\s*[([](\d{4})[)\]]$/.exec(rest);
  if (bracketedYear) {
    rest = bracketedYear[1];
    year = toYear(bracketedYear[2]);
  }
  const parts = rest.split(/\s+[-–]\s+/);
  // A year before the title, as the last part is the title even if it's a
  // number, like Prince's "1999".
  const yearPart = parts.findIndex(
    (part, index) => index < parts.length - 1 && /^\d{4}$/.test(part),
  );
  if (yearPart !== -1) {
    year ??= toYear(parts[yearPart]);
    parts.splice(yearPart, 1);
  }
  return parts.length > 1
    ? {
        artist: known(parts[0]),
        title: known(parts.slice(1).join(" - ")),
        year,
      }
    : { title: known(parts[0]), year };
}

interface PlacedTrack {
  track: Track;
  title: string;
  /** The album's folder below the one chosen, "" for that folder itself. */
  folder: string;
  isNamedFromFolder: boolean;
  /** For files without artist tags: from the folder's name or the one above. */
  folderArtist?: string;
  folderYear?: number;
}

/** Works out a track's album title, and what its folders say. */
function place(track: Track): PlacedTrack | undefined {
  const { folders } = track;
  // A disc's own folder is part of the album's.
  const albumFolders =
    folders.length > 0 && DISC_FOLDER.test(folders[folders.length - 1].trim())
      ? folders.slice(0, -1)
      : folders;
  // The folder chosen isn't named here, so a folder like "Music" is never
  // taken for an album or an artist.
  const fromName =
    albumFolders.length > 0
      ? readFolderName(albumFolders[albumFolders.length - 1])
      : undefined;
  const folderAbove =
    albumFolders.length > 1
      ? known(albumFolders[albumFolders.length - 2])
      : undefined;
  const tagged = known(track.album);
  const title = tagged ? withoutDisc(tagged) : fromName?.title;
  if (!title) {
    return undefined;
  }
  return {
    track,
    title,
    folder: albumFolders.join("/"),
    isNamedFromFolder: !tagged,
    folderArtist: fromName?.artist ?? folderAbove,
    folderYear: fromName?.year,
  };
}

/**
 * The artist of an album whose tracks are in a folder of their own: the
 * album artist its files are tagged with, Various Artists for a compilation,
 * or the artist of more than half of its tracks.
 */
function folderAlbumArtist(tracks: PlacedTrack[]) {
  const albumArtist = mostCommon(
    tracks.flatMap(({ track }) => known(track.albumArtist) ?? []),
    keyOf,
  );
  if (albumArtist) {
    return albumArtist.value;
  }
  if (tracks.some(({ track }) => track.compilation)) {
    return VARIOUS_ARTISTS;
  }
  const artists = tracks.flatMap(({ track }) => {
    const artist = known(track.artist);
    return artist ? [mainArtist(artist)] : [];
  });
  if (artists.length === 0) {
    return tracks.find(({ folderArtist }) => folderArtist)?.folderArtist;
  }
  const artist = mostCommon(artists, keyOf)!;
  return artist.count > artists.length / 2 ? artist.value : VARIOUS_ARTISTS;
}

/** The artist of a track in a folder of tracks from more than one album. */
function trackAlbumArtist({ track, folderArtist }: PlacedTrack) {
  const albumArtist = known(track.albumArtist);
  if (albumArtist) {
    return albumArtist;
  }
  if (track.compilation) {
    return VARIOUS_ARTISTS;
  }
  const artist = known(track.artist);
  return artist ? mainArtist(artist) : folderArtist;
}

/** How many different tracks there are, counting copies of one track once. */
function countTracks(tracks: Track[]) {
  const numbered = new Set(
    tracks.flatMap(({ disc, track }) =>
      track === undefined ? [] : [`${disc ?? 1}:${track}`],
    ),
  );
  return (
    numbered.size + tracks.filter(({ track }) => track === undefined).length
  );
}

/** How many tracks the discs found have, if every one of them says. */
function countTotalTracks(tracks: Track[]) {
  const discs = new Map<number, number | undefined>();
  for (const { disc = 1, tracksOnDisc } of tracks) {
    discs.set(
      disc,
      Math.max(discs.get(disc) ?? 0, tracksOnDisc ?? 0) || undefined,
    );
  }
  const counts = [...discs.values()];
  return counts.every((count) => count !== undefined)
    ? counts.reduce((sum, count) => sum + count, 0)
    : undefined;
}

function toFoundAlbum(
  key: string,
  placed: PlacedTrack[],
  artist: string,
): FoundAlbum {
  const tracks = placed.map(({ track }) => track);
  const releaseGroupId = mostCommon(
    tracks.flatMap(({ releaseGroupId }) => releaseGroupId ?? []),
  )?.value;
  const typed = tracks.filter(({ releaseTypes }) => releaseTypes.length > 0);
  const year =
    commonYear(tracks.map(({ originalYear }) => originalYear)) ??
    commonYear(tracks.map(({ year }) => year)) ??
    commonYear(placed.map(({ folderYear }) => folderYear));
  return {
    key,
    title: placed[0].title,
    artist,
    ...(year !== undefined && { year }),
    ...(releaseGroupId && { releaseGroupId }),
    tracks: countTracks(tracks),
    totalTracks: countTotalTracks(tracks),
    isSingle:
      typed.length > 0 &&
      typed.every(({ releaseTypes }) => releaseTypes[0] === "single"),
    isNamedFromFolder: placed.some(
      ({ isNamedFromFolder }) => isNamedFromFolder,
    ),
  };
}

/**
 * Puts the tracks of a music folder together into albums, by artist and title,
 * so that the discs of an album and copies of it in other file types make one
 * album. Albums are sorted by artist, then title. `unplaced` counts the tracks
 * whose album couldn't be worked out.
 */
export function findAlbums(tracks: Track[]) {
  const placed = tracks.flatMap((track) => place(track) ?? []);
  const folders = new Map<string, PlacedTrack[]>();
  for (const track of placed) {
    folders.set(track.folder, [...(folders.get(track.folder) ?? []), track]);
  }

  const albums = new Map<string, { artist: string; tracks: PlacedTrack[] }>();
  let unplaced = tracks.length - placed.length;
  for (const inFolder of folders.values()) {
    // A folder of one album shares out its artist, so tracks with guests, or
    // a compilation's tracks, stay together.
    const isOneAlbum =
      new Set(inFolder.map(({ title }) => keyOf(title))).size === 1;
    const folderArtist = isOneAlbum ? folderAlbumArtist(inFolder) : undefined;
    for (const track of inFolder) {
      const artist = isOneAlbum ? folderArtist : trackAlbumArtist(track);
      if (!artist) {
        unplaced += 1;
        continue;
      }
      const key = `${keyOf(artist)}\n${keyOf(track.title)}`;
      const album = albums.get(key) ?? { artist, tracks: [] };
      album.tracks.push(track);
      albums.set(key, album);
    }
  }

  return {
    albums: [...albums]
      .map(([key, { artist, tracks }]) => toFoundAlbum(key, tracks, artist))
      .sort(
        (a, b) =>
          a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      ),
    unplaced,
  };
}

/** Why a found album looks incomplete, if it does. */
export function whyIncomplete({ tracks, totalTracks, isSingle }: FoundAlbum) {
  if (isSingle) {
    return "Single";
  }
  if (totalTracks !== undefined) {
    return tracks < totalTracks / 2
      ? `${tracks} of ${totalTracks} tracks`
      : undefined;
  }
  return tracks < 3
    ? `Only ${tracks} track${tracks === 1 ? "" : "s"}`
    : undefined;
}
