const API_URL = "https://musicbrainz.org/ws/2";
export const COVER_ART_URL = "https://coverartarchive.org/release-group";
// MusicBrainz sheds requests with a 503 in short bursts when it's busy, and
// its gateway or the connection can drop briefly too, so back off and retry
// before giving up.
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRY_STATUSES = [502, 503, 504];

/** Why a request to MusicBrainz failed. */
export class MusicBrainzError extends Error {
  constructor(
    readonly reason: "offline" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

export type ArtistCredit = { name: string; joinphrase?: string }[];

/** The artists as credited, like "Miles Davis / John Coltrane". */
export const creditedArtist = (credit: ArtistCredit = []) =>
  credit.map(({ name, joinphrase = "" }) => name + joinphrase).join("");

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
 * Gets JSON from MusicBrainz's API, such as `release-group/?query=…`. Throws
 * a MusicBrainzError when offline, or once MusicBrainz still fails after
 * retries.
 */
export async function getFromMusicBrainz<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${API_URL}/${path}?${new URLSearchParams({ ...params, fmt: "json" })}`;
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
        throw new MusicBrainzError("offline", "The browser is offline");
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
    throw new MusicBrainzError(
      "unavailable",
      response
        ? `MusicBrainz failed with ${response.status}`
        : "Couldn't connect to MusicBrainz",
    );
  }
  return response.json();
}
