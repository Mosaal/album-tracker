import {
  ArtistCredit,
  COVER_ART_URL,
  creditedArtist,
  getFromMusicBrainz,
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
