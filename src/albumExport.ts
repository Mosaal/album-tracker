import { createCsv } from "./csv";
import { createJson } from "./json";
import { Album } from "./types";

export type ExportFormat = "json" | "csv";

const MIME_TYPES: Record<ExportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
};

// en-CA writes dates as YYYY-MM-DD, in local time.
const today = () => new Date().toLocaleDateString("en-CA");

/** Downloads the whole collection as a JSON or CSV file. */
export function exportAlbums(albums: Album[], format: ExportFormat) {
  const contents = format === "json" ? createJson(albums) : createCsv(albums);
  const url = URL.createObjectURL(
    new Blob([contents], { type: MIME_TYPES[format] }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `album-tracker-${today()}.${format}`;
  link.click();
  // Safari can still be reading the file just after the click.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}
