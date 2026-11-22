import {
  ArtistCredit,
  COVER_ART_URL,
  creditedArtist,
  getFromMusicBrainz,
  MusicBrainzError,
} from "./musicBrainz";

export interface CoverResult {
  id: string;
  title: string;
  artist: string;
  year?: string;
  thumbnailUrl: string;
  imageUrl: string;
}

interface ReleaseGroupSearchResponse {
  "release-groups": {
    id: string;
    title: string;
    "first-release-date"?: string;
    "artist-credit"?: ArtistCredit;
  }[];
}

// Escapes MusicBrainz's Lucene query syntax. Lowercasing stops a title word
// like "AND" being read as an operator.
function toSearchTerms(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

/**
 * Finds albums on MusicBrainz and returns their Cover Art Archive images.
 * Not every album has a cover, so some image URLs will 404. Throws a
 * MusicBrainzError when offline or once MusicBrainz still fails after retries.
 */
export async function searchCovers(
  title: string,
  artist: string,
  signal?: AbortSignal,
): Promise<CoverResult[]> {
  const query = [`releasegroup:(${toSearchTerms(title)})`];
  if (artist.trim()) {
    query.push(`artist:(${toSearchTerms(artist)})`);
  }
  const data = await getFromMusicBrainz<ReleaseGroupSearchResponse>(
    "release-group/",
    { query: query.join(" AND "), limit: "8" },
    signal,
  );

  return data["release-groups"].map((group) => ({
    id: group.id,
    title: group.title,
    artist: creditedArtist(group["artist-credit"]),
    year: group["first-release-date"]?.slice(0, 4) || undefined,
    thumbnailUrl: `${COVER_ART_URL}/${group.id}/front-250`,
    imageUrl: `${COVER_ART_URL}/${group.id}/front-500`,
  }));
}

/** What an album's cover is looked up by. */
export interface CoverQuery {
  title: string;
  artist: string;
  year?: number;
}

// Words that mark an edition rather than the album, in brackets at the end of
// a title, like "(Remastered 2009)" and "[Deluxe Edition]", or after a dash,
// like " - 2011 Remaster" and the " - EP" that stores add.
const EDITION_WORDS =
  "remaster(?:ed)?|deluxe|edition|expanded|anniversary|bonus|version|reissue|mono|stereo|ep|single";
const EDITION = new RegExp(
  `\\s*(?:[([][^)\\]]*\\b(?:${EDITION_WORDS})\\b[^)\\]]*[)\\]]|\\s[-–]\\s[^-–]*\\b(?:${EDITION_WORDS})\\b[^-–]*)$`,
  "i",
);
// Results to check for a cover, at most, so one album can't take long.
const COVERS_TO_CHECK = 3;

/** An album's title without what marks its edition, like "(Remastered)". */
export function withoutEdition(title: string) {
  let base = title.trim();
  for (let previous = ""; base !== previous;) {
    previous = base;
    base = base.replace(EDITION, "").trim();
  }
  return base || title.trim();
}

/** As compared: without accents, case, punctuation or a leading "The". */
const comparable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    // Dropped rather than spaced, so "Pepper's" is "peppers" and "R.E.M." "rem".
    .replace(/['’`´.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");

/**
 * The search results that are this album: the same title, whatever the
 * edition, and the same artist. Those from the year closest to the album's
 * come first, as searches can rank reissues and other albums higher.
 */
export function matchCovers(album: CoverQuery, results: CoverResult[]) {
  const title = comparable(withoutEdition(album.title));
  const artist = comparable(album.artist);
  const distance = (result: CoverResult) =>
    album.year === undefined || result.year === undefined
      ? Number.MAX_SAFE_INTEGER
      : Math.abs(Number(result.year) - album.year);
  return results
    .filter(
      (result) =>
        comparable(withoutEdition(result.title)) === title &&
        comparable(result.artist) === artist,
    )
    .sort((a, b) => distance(a) - distance(b));
}

/**
 * Whether the Cover Art Archive has this cover. It redirects to the image
 * when it has, which the browser hides when redirects are handled by hand,
 * and answers 404 when it hasn't.
 */
async function hasCover(imageUrl: string, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(imageUrl, {
      method: "HEAD",
      redirect: "manual",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw navigator.onLine
      ? new MusicBrainzError("unavailable", "Couldn't connect to the archive")
      : new MusicBrainzError("offline", "The browser is offline");
  }
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 200 && response.status < 400)
  ) {
    return true;
  }
  if (response.status === 404) {
    return false;
  }
  throw new MusicBrainzError(
    "unavailable",
    `The Cover Art Archive failed with ${response.status}`,
  );
}

/**
 * Looks up an album's cover: searches MusicBrainz by its title and artist, and
 * takes the cover of the first result that's the same album, from the year
 * closest to its own, that the Cover Art Archive has a cover for. Returns
 * undefined when there's none. Throws a MusicBrainzError when offline or when
 * MusicBrainz or the archive fail.
 */
export async function findCover(album: CoverQuery, signal?: AbortSignal) {
  const results = await searchCovers(
    withoutEdition(album.title),
    album.artist,
    signal,
  );
  for (const result of matchCovers(album, results).slice(0, COVERS_TO_CHECK)) {
    if (await hasCover(result.imageUrl, signal)) {
      return result.imageUrl;
    }
  }
  return undefined;
}
