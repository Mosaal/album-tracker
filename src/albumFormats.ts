import { AlbumFormat } from "./types";

export const FORMAT_LABELS: Record<AlbumFormat, string> = {
  vinyl: "Vinyl",
  cd: "CD",
  cassette: "Cassette",
  digital: "Digital",
  other: "Other",
};

export const FORMAT_OPTIONS = (
  Object.entries(FORMAT_LABELS) as [AlbumFormat, string][]
).map(([value, label]) => ({ value, label }));

// Names are compared as lowercase letters and digits only.
const FORMAT_NAMES: Record<string, AlbumFormat> = {
  vinyl: "vinyl",
  lp: "vinyl",
  record: "vinyl",
  12: "vinyl",
  10: "vinyl",
  7: "vinyl",
  cd: "cd",
  compactdisc: "cd",
  cassette: "cassette",
  cass: "cassette",
  tape: "cassette",
  digital: "digital",
  file: "digital",
  download: "digital",
  mp3: "digital",
  flac: "digital",
  other: "other",
};

/**
 * Reads a format from a file, by name or a common synonym. Anything else
 * counts as "other", and a blank one as no format.
 */
export function toFormat(value: unknown): AlbumFormat | undefined {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }
  // Discogs lists the medium first, with a count, like "2xLP, Album, RE".
  const name = value
    .split(",")[0]
    .toLowerCase()
    .replace(/^\s*\d+\s*x/, "")
    .replace(/[^a-z0-9]/g, "");
  return FORMAT_NAMES[name] ?? "other";
}
