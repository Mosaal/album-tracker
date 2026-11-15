const SEARCH_URL = "https://musicbrainz.org/ws/2/release-group/";
const COVER_ART_URL = "https://coverartarchive.org/release-group";
// MusicBrainz sheds search requests with a 503 in short bursts when it's busy,
// and its gateway or the connection can drop briefly too, so back off and
// retry before giving up.
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRY_STATUSES = [502, 503, 504];

/** Why a cover search failed. */
export class CoverSearchError extends Error {
  constructor(
    readonly reason: "offline" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

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
    "artist-credit"?: { name: string; joinphrase?: string }[];
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

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * Finds albums on MusicBrainz and returns their Cover Art Archive images.
 * Not every album has a cover, so some image URLs will 404. Throws a
 * CoverSearchError when offline or once MusicBrainz still fails after retries.
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
  const params = new URLSearchParams({
    query: query.join(" AND "),
    fmt: "json",
    limit: "8",
  });

  const url = `${SEARCH_URL}?${params}`;
  let response: Response | undefined;
  for (const delayMs of [0, ...RETRY_DELAYS_MS]) {
    if (delayMs > 0) {
      await wait(delayMs, signal);
    }
    try {
      response = await fetch(url, { signal });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      if (!navigator.onLine) {
        throw new CoverSearchError("offline", "The browser is offline");
      }
      // The connection dropped: try again.
      response = undefined;
      continue;
    }
    if (!RETRY_STATUSES.includes(response.status)) {
      break;
    }
  }

  if (!response?.ok) {
    throw new CoverSearchError(
      "unavailable",
      response
        ? `MusicBrainz search failed with ${response.status}`
        : "Couldn't connect to MusicBrainz",
    );
  }
  const data: ReleaseGroupSearchResponse = await response.json();

  return data["release-groups"].map((group) => ({
    id: group.id,
    title: group.title,
    artist: (group["artist-credit"] ?? [])
      .map(({ name, joinphrase = "" }) => name + joinphrase)
      .join(""),
    year: group["first-release-date"]?.slice(0, 4) || undefined,
    thumbnailUrl: `${COVER_ART_URL}/${group.id}/front-250`,
    imageUrl: `${COVER_ART_URL}/${group.id}/front-500`,
  }));
}
