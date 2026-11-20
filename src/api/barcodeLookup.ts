import { toYear } from "../albums/albumYears";
import { AlbumFormat } from "../types";
import {
  ArtistCredit,
  COVER_ART_URL,
  creditedArtist,
  getFromMusicBrainz,
} from "./musicBrainz";

/** An album found by its barcode, to fill in the album form with. */
export interface BarcodeAlbum {
  title: string;
  artist: string;
  year?: number;
  format?: AlbumFormat;
  coverUrl: string;
}

interface ReleaseSearchResponse {
  releases: {
    title: string;
    "artist-credit"?: ArtistCredit;
    "release-group": { id: string; title?: string };
    media?: { format?: string | null }[];
  }[];
}

interface ReleaseGroupResponse {
  "first-release-date"?: string;
}

/** The digits of a barcode as typed, or undefined if they can't be one. */
export function toBarcode(text: string) {
  const digits = text.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : undefined;
}

// A UPC is an EAN-13 that starts with 0, and MusicBrainz has either.
function barcodeForms(barcode: string) {
  if (barcode.length === 12) {
    return [barcode, `0${barcode}`];
  }
  if (barcode.length === 13 && barcode.startsWith("0")) {
    return [barcode, barcode.slice(1)];
  }
  return [barcode];
}

/** The app's format for a MusicBrainz medium, like "CD" or '12" Vinyl'. */
export function toAlbumFormat(medium?: string | null): AlbumFormat | undefined {
  if (!medium) {
    return undefined;
  }
  const name = medium.toLowerCase();
  if (name.includes("vinyl")) {
    return "vinyl";
  }
  if (name.includes("cd")) {
    return "cd";
  }
  if (name.includes("cassette")) {
    return "cassette";
  }
  return name.includes("digital") ? "digital" : "other";
}

// A release only has its own date, so the year the album first came out is
// its release group's. Without it, the album is still worth filling in.
async function firstReleaseYear(groupId: string, signal?: AbortSignal) {
  try {
    const group = await getFromMusicBrainz<ReleaseGroupResponse>(
      `release-group/${groupId}`,
      {},
      signal,
    );
    return toYear(group["first-release-date"]);
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return undefined;
  }
}

/**
 * Finds the album with this barcode on MusicBrainz: undefined if there's
 * none. Throws a MusicBrainzError when offline or once MusicBrainz still
 * fails after retries.
 */
export async function lookUpBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<BarcodeAlbum | undefined> {
  const query = barcodeForms(barcode)
    .map((form) => `barcode:${form}`)
    .join(" OR ");
  const { releases } = await getFromMusicBrainz<ReleaseSearchResponse>(
    "release/",
    { query, limit: "1" },
    signal,
  );
  const [release] = releases;
  if (!release) {
    return undefined;
  }

  const group = release["release-group"];
  return {
    title: group.title || release.title,
    artist: creditedArtist(release["artist-credit"]),
    year: await firstReleaseYear(group.id, signal),
    format: toAlbumFormat(release.media?.[0]?.format),
    coverUrl: `${COVER_ART_URL}/${group.id}/front-500`,
  };
}
